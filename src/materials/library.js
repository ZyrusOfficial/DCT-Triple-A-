/**
 * Material library.
 *
 * A deliberately small, hand-tuned set. Every surface in the world maps to one
 * of these so the renderer can batch aggressively and the shader permutations
 * stay warm (no hitching on an iGPU).
 */
import * as THREE from 'three';
import * as T from './textures.js';

const STD = (opts) => new THREE.MeshStandardMaterial(opts);

/**
 * Attach derived normal + roughness maps to a material.
 *
 * Both are generated from the material's own colour map, so they are perfectly
 * registered with it. Cheap: a Sobel pass over a 512/256 map is a few
 * milliseconds, done once at build time.
 *
 * @param mat       MeshStandardMaterial to modify in place
 * @param strength  normal-map strength; 0.6 is a faint grain, 3+ is deep relief
 * @param rough     { base, swing } for the roughness map, or null to skip
 */
function enhance(mat, strength = 1.4, rough = null) {
  const src = mat && mat.map && mat.map.image;
  if (!src || !src.width) return mat;
  /**
   * Build the maps at a small fixed resolution, reading the source ONCE.
   *
   * `getImageData` on a 512^2 canvas measures 8.8 SECONDS in SwiftShader (and is
   * slow on real iGPUs too) because it forces a full readback of a GPU-backed
   * canvas. Calling it per material — twice, once for the normal map and once
   * for roughness — was 120 s of a 121 s world build.
   *
   * Instead the source is downsampled ONCE to 128^2 with drawImage (cheap, stays
   * on the GPU), read back once, and both maps are generated from that single
   * readback in plain JS. 128^2 of low-frequency relief is indistinguishable
   * from 512^2 under mipmapping, and it cuts the per-material cost by ~16x.
   */
  const RES = typeof window !== 'undefined' && window.__reliefRes ? window.__reliefRes : 128;
  const sc = document.createElement('canvas');
  sc.width = sc.height = RES;
  const sx = sc.getContext('2d', { willReadFrequently: true });
  sx.drawImage(src, 0, 0, RES, RES);
  const px = sx.getImageData(0, 0, RES, RES).data;

  const hgt = new Float32Array(RES * RES);
  const lum = new Float32Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    lum[i] = (px[i * 4] * 0.2126 + px[i * 4 + 1] * 0.7152 + px[i * 4 + 2] * 0.0722) / 255;
  }
  hgt.set(lum);

  const n = T.normalFromHeight(hgt, RES, RES, strength);
  mat.normalMap = T.finish(n, {
    repeat: [mat.map.repeat.x, mat.map.repeat.y], srgb: false,
  });
  mat.normalScale = new THREE.Vector2(1, 1);
  if (rough) {
    const r = T.roughnessFromLum(lum, RES, RES, rough.base, rough.swing);
    mat.roughnessMap = T.finish(r, {
      repeat: [mat.map.repeat.x, mat.map.repeat.y], srgb: false,
    });
  }
  mat.needsUpdate = true;
  return mat;
}

export function buildMaterials() {
  const M = {};

  /* --------------------------------------------------------- DCT palette */
  // Main building: cream/off-white painted concrete with mauve-pink banding.
  M.dctWall = STD({
    map: T.stucco('#efe7d6', { seed: 5, dirt: 0.5 }),
    color: 0xffffff, roughness: 0.86, metalness: 0.0,
  });

  M.dctBand = STD({
    map: T.stucco('#c98e93', { seed: 8, dirt: 0.35 }),
    roughness: 0.85, metalness: 0.0,
  });

  M.dctAccent = STD({
    map: T.stucco('#a86a72', { seed: 12, dirt: 0.3 }),
    roughness: 0.82, metalness: 0.0,
  });

  // Church: pale sand stucco with strong vertical pilasters.
  M.churchWall = STD({
    map: T.stucco('#f4ead4', { seed: 2, dirt: 0.55 }),
    roughness: 0.88, metalness: 0.0,
  });
  M.churchDome = STD({
    map: T.stucco('#f2ead8', { seed: 44, dirt: 0.55 }), roughness: 0.66, metalness: 0.02,
  });
  M.churchTrim = STD({
    map: T.stucco('#f6efdd', { seed: 21, dirt: 0.4 }),
    roughness: 0.8, metalness: 0.0,
  });
  // Bell tower brickwork — red brick with pale mortar bands.
  M.brick = STD({
    map: T.brickTex(),
    roughness: 0.92, metalness: 0.0,
  });

  /* -------------------------------------------------------------- paints */
  M.paintWhite = STD({ map: T.stucco('#f4f0e6', { seed: 31, dirt: 0.22 }), roughness: 0.62, metalness: 0.02 });
  M.paintCream = STD({ map: T.stucco('#eee3c9', { seed: 32, dirt: 0.3 }), roughness: 0.7 });
  M.paintWarm = STD({ map: T.stucco('#ddd0b4', { seed: 33, dirt: 0.34 }), roughness: 0.75 });
  M.paintGreen = STD({ color: 0x2f5c3f, roughness: 0.55, metalness: 0.06 });
  M.paintRed = STD({ color: 0x8c2432, roughness: 0.52, metalness: 0.06 });

  M.concrete = STD({ map: T.concreteSlab('#b7b2a8', 3), roughness: 0.9 });
  M.concreteTrim = STD({ map: T.concreteSlab('#cdc8bd', 1), roughness: 0.8 });
  M.concreteDark = STD({ map: T.concreteSlab('#918c84', 4), roughness: 0.94 });
  /**
   * Basin liners and any other surface inside a concave well.
   *
   * The fountain basin's inner wall is a vertical cylinder facing away from the
   * sun at every hour, with nothing above it but sky — so at roughness 0.94 it
   * rendered near-black and the whole fountain read as a black bowl of blue
   * paint. Real basin walls are tiled pale and are the brightest thing in the
   * well. This is deliberately albedo-heavy and slightly emissive rather than a
   * roughness tweak, because the problem is total absence of light, not gloss.
   *
   * floorTile(hex, groutHex) — no options object; repeats come from the
   * geometry's UV scale, not the texture call.
   */
  M.basinLiner = STD({
    map: T.floorTile('#d8d2c4', '#b8b0a0'),
    roughness: 0.62,
    emissive: 0x6a6558, emissiveIntensity: 0.30,
  });

  M.paving = STD({ map: T.pavers('#998674'), roughness: 0.88 });
  // Plaza paving: a warmer, slightly darker tan than the campus yard, so the
  // town park reads differently from the school apron.
  M.pavingWarm = STD({ map: T.pavers('#8a7159'), roughness: 0.9 });
  M.pavingRed = STD({ map: T.pavers('#8e6250'), roughness: 0.88 });
  M.tileRed = STD({ map: T.floorTile('#ab4f39', '#83735f'), roughness: 0.46, metalness: 0.02 });
  M.sanctuaryTile = STD({
    map: T.floorTile('#9a8260', '#7d6850'), roughness: 0.58,
    emissive: 0x9a8462, emissiveIntensity: 0.50,
  });
  M.tileCream = STD({ map: T.floorTile('#cfc4ae', '#a89c88'), roughness: 0.46, metalness: 0.02 });
  // Granite. #b9b2a6 at roughness 0.5 with a bright sky reads as pure white —
  // it was the pale band across the shrine forecourt. Real plaza granite is a
  // mid warm grey, and it needs to be rough enough to break up sky reflection.
  M.granite = STD({ map: T.graniteTile('#8d867a'), roughness: 0.72, metalness: 0.02 });

  M.asphalt = STD({ map: T.asphalt(), roughness: 0.9, metalness: 0.0 });
  M.asphalt.userData.texScale = 9;

  M.grass = STD({ map: T.grass(), roughness: 0.96, metalness: 0.0 });
  M.gravel = STD({ map: T.gravel(), roughness: 0.94 });
  M.soil = STD({ map: T.soil(), roughness: 0.98 });

  /* ---------------------------------------------------------------- roofs */
  M.roofRib = STD({ map: T.ribbedRoof('#8a3a33'), roughness: 0.58, metalness: 0.22 });
  M.roofGray = STD({ map: T.ribbedRoof('#5c6166'), roughness: 0.55, metalness: 0.3 });
  M.roofRust = STD({ map: T.ribbedRoof('#7a4a30'), roughness: 0.72, metalness: 0.18 });
  M.walkwayRoof = STD({ map: T.ribbedRoof('#a8adad'), roughness: 0.62, metalness: 0.20 });
  // Galvanised sheet. High metalness + a bright sky = a mirror that clips to
  // white; real weathered galvanising is a dull grey with a broad highlight.
  M.galv = STD({ map: T.galvanized(), color: 0x8b9296, roughness: 0.68, metalness: 0.22 });
  M.galv.roofDull = true;

  /* ---------------------------------------------------------------- metal */
  M.ironDark = STD({ map: T.brushedMetal('#3a3f45', 0.4), roughness: 0.42, metalness: 0.72 });
  M.steel = STD({ map: T.brushedMetal('#9aa3aa', 0.35), roughness: 0.34, metalness: 0.85 });
  M.brass = STD({ color: 0x9c7c33, roughness: 0.28, metalness: 0.9 });
  M.chrome = STD({ color: 0xd8dde2, roughness: 0.12, metalness: 1.0 });
  M.aluminum = STD({ color: 0xb9c0c6, roughness: 0.3, metalness: 0.9 });

  /* ----------------------------------------------------------------- wood */
  M.bannerMap = T.bannerTex(['DOMINICAN', 'COLLEGE', 'OF TARLAC'], '#b8325a');

  /* ------------------------------------------------------ road & court paint */
  M.roadPaintYellow = STD({ color: 0xd8b13a, roughness: 0.7, metalness: 0.0 });
  M.roadPaintWhite = STD({ color: 0xdfdcd4, roughness: 0.72 });
  M.grassFar = STD({ color: 0x4a5c38, roughness: 1.0 });
  M.courtFloor = STD({ color: 0x4b6b52, roughness: 0.86 });

  /* --------------------------------------------------------- town palette */
  M.houseWallA = STD({ map: T.stucco('#d8cfbc', { seed: 61, dirt: 0.6 }), roughness: 0.9 });
  M.houseWallB = STD({ map: T.stucco('#e3d5c0', { seed: 62, dirt: 0.6 }), roughness: 0.9 });
  M.houseWallC = STD({ map: T.stucco('#bcd0cd', { seed: 63, dirt: 0.65 }), roughness: 0.9 });
  M.houseWallD = STD({ map: T.stucco('#c9b9a6', { seed: 64, dirt: 0.65 }), roughness: 0.9 });
  M.roofTile = STD({ map: T.ribbedRoof('#a4563b'), roughness: 0.7, metalness: 0.08 });
  M.bannerCloth = STD({ map: T.bannerTex(['DOMINICAN', 'COLLEGE', 'OF TARLAC'], '#b8325a'), roughness: 0.9, side: THREE.DoubleSide });
  M.hillFar = STD({ color: 0x3f5540, roughness: 1.0 });
  M.treeFar = STD({ color: 0x2c3f28, roughness: 1.0 });

  /* ------------------------------------------------------------------ stone */
  // Rock-faced wall of the DCT frontage grotto: irregular rough stones.
  M.rockFace = STD({ map: T.rockFaceTex('#8a8175'), roughness: 0.95, metalness: 0.0 });
  M.rockFace.userData.texScale = 2.0;
  M.rockCap = STD({ map: T.rockFaceTex('#6f6a61'), roughness: 0.92 });
  M.wood = STD({ map: T.wood('#7a4522'), roughness: 0.55, metalness: 0.0 });
  M.woodDark = STD({ map: T.wood('#4b2a14'), roughness: 0.5 });
  // Soffit timber: lighter so a deep porch ceiling reads as wood, not a void.
  // Soffit timber. Kept deliberately pale (a limed timber ceiling): surfaces
  // that are permanently in shadow have to be high-albedo or they render black
  // no matter how bright the fill is.
  M.woodSoffit = STD({ map: T.wood('#a8845c'), roughness: 0.7 });
  M.soffitPanel = STD({ map: T.wood('#d8cbb2'), roughness: 0.78 });
  M.woodPale = STD({ map: T.wood('#a3763f'), roughness: 0.6 });

  /* ---------------------------------------------------------------- glass */
  M.glass = STD({
    map: T.glazing('#33474f', 0.0), color: 0xffffff,
    roughness: 0.06, metalness: 0.0,
    transparent: true, opacity: 0.72,
    envMapIntensity: 1.5, side: THREE.DoubleSide,
  });
  M.glassLit = STD({
    map: T.glazing('#5a5040', 0.85), roughness: 0.09, metalness: 0.0,
    emissive: 0xffdcae, emissiveIntensity: 0.55, emissiveMap: T.glazing('#5a5040', 0.85),
  });
  M.glassDark = STD({
    map: T.glazing('#1d262b', 0.0), roughness: 0.05, metalness: 0.1,
    transparent: true, opacity: 0.88, envMapIntensity: 2.0,
  });
  // Recesses / openings. Not pure black: a real opening under a soffit still
  // shows warm bounce light on the inner reveals, and a literal 0x14 black reads
  // on screen as a hole punched out of the render.
  M.interior = STD({ color: 0x2b2822, roughness: 1.0, envMapIntensity: 0.25 });
  M.interiorWarm = STD({ color: 0x4a4038, roughness: 0.95, envMapIntensity: 0.3 });

  /* ------------------------------------------------------------ vegetation */
  M.leafNear = new THREE.MeshStandardMaterial({
    map: T.leafCluster(3, [0.19, 0.33, 0.12]), alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.78, metalness: 0.0, transparent: false,
  });
  M.leafNear.userData.foliage = true;
  // Opaque crown cores give trees real silhouette + self-shadowing.
  M.leafCoreNear = STD({ color: 0x22391b, roughness: 0.92, metalness: 0.0, flatShading: true });
  M.leafCoreMid = STD({ color: 0x283f1e, roughness: 0.93, flatShading: true });
  M.leafCoreDark = STD({ color: 0x16250f, roughness: 0.94, flatShading: true });
  M.leafMid = new THREE.MeshStandardMaterial({
    map: T.leafCluster(7, [0.23, 0.38, 0.14]), alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.8, metalness: 0.0,
  });
  M.leafMid.userData.foliage = true;
  M.leafDark = new THREE.MeshStandardMaterial({
    map: T.leafCluster(11, [0.13, 0.24, 0.10]), alphaTest: 0.42, side: THREE.DoubleSide,
    roughness: 0.82, metalness: 0.0,
  });
  M.leafDark.userData.foliage = true;
  M.frond = new THREE.MeshStandardMaterial({
    map: T.palmFrond(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7,
  });
  M.frond.userData.foliage = true;
  M.hedge = new THREE.MeshStandardMaterial({ map: T.hedgeTex(), roughness: 0.88, side: THREE.DoubleSide, alphaTest: 0.35 });
  M.hedgeSolid = STD({ map: T.hedgeTex(), roughness: 0.9, metalness: 0.0 });
  M.hedge.userData.foliage = true;
  M.bark = STD({ map: T.bark(), roughness: 0.92 });
  M.grassCard = new THREE.MeshStandardMaterial({
    map: T.grassCardTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95,
  });
  M.flowerRed = STD({ color: 0xb6243f, roughness: 0.7, side: THREE.DoubleSide });
  M.flowerPink = STD({ color: 0xd4647f, roughness: 0.7, side: THREE.DoubleSide });
  M.flowerWhite = STD({ color: 0xe8e2d2, roughness: 0.68, side: THREE.DoubleSide });
  M.flowerYellow = STD({ color: 0xd7a521, roughness: 0.66, side: THREE.DoubleSide });

  /* --------------------------------------------------------------- signage */
  M.signChurch = new THREE.MeshStandardMaterial({
    map: T.textSign('SAN NICOLAS DE TOLENTINO PARISH', {
      w: 2048, h: 160, font: '700 92px "Helvetica Neue", Arial, sans-serif',
      color: '#232323', track: 6,
    }),
    transparent: true, roughness: 0.5, alphaTest: 0.02, side: THREE.DoubleSide,
  });
  M.signDCT = new THREE.MeshStandardMaterial({
    map: T.textSign('DOMINICAN COLLEGE OF TARLAC', {
      w: 2048, h: 200, font: '700 118px "Helvetica Neue", Arial, sans-serif',
      color: '#2a2a2a', track: 4,
    }),
    transparent: true, roughness: 0.5, alphaTest: 0.02, side: THREE.DoubleSide,
  });
  M.signCapas = new THREE.MeshStandardMaterial({
    map: T.textSign('CAPAS', { w: 1024, h: 320, font: '800 250px Impact, "Arial Black", sans-serif', color: '#e8e8e8' }),
    transparent: true, roughness: 0.6, alphaTest: 0.02, side: THREE.DoubleSide,
  });
  M.crest = new THREE.MeshStandardMaterial({
    map: T.dctCrest(), transparent: true, roughness: 0.42, metalness: 0.05,
    alphaTest: 0.02, side: THREE.DoubleSide,
  });

  /* ------------------------------------------------------------- accents */
  M.dctPink = STD({ color: 0xb8325a, roughness: 0.46, metalness: 0.05 });
  M.statue = STD({ color: 0xd9d2c4, roughness: 0.72, metalness: 0.02 });
  M.statueRobed = STD({ color: 0x1d1a18, roughness: 0.66, metalness: 0.03 });
  M.gold = STD({
    color: 0xc79a38, roughness: 0.3, metalness: 0.9,
    emissive: 0x6e4e12, emissiveIntensity: 0.42,
  });
  M.fabric = STD({ color: 0x6b1f2e, roughness: 0.9 });

  /* ------------------------------------------------------------ water etc */
  /**
   * Water.
   *
   * With roughness 0.06 and no normal map this was a mirror: under a featureless
   * sky dome there is nothing to reflect, so every basin and pool on the campus
   * read as a flat sheet of opaque blue paint. Water reads as water through its
   * broken, glinting surface — so the fix is ripples, and a slightly rougher
   * surface that catches the sky as broken highlights instead of one flat value.
   */
  M.water = new THREE.MeshStandardMaterial({
    color: 0x4e7f96, roughness: 0.14, metalness: 0.06,
    normalMap: T.waterNormals(),
    normalScale: new THREE.Vector2(0.85, 0.85),
    transparent: true, opacity: 0.72, envMapIntensity: 2.1,
  });

  for (const k of Object.keys(M)) {
    if (M[k].map) M[k].map.anisotropy = 8;
  }
  /* ------------------------------------------------- DCT CLASSROOM BLOCKS */
  /**
   * The buildings flanking the gate are painted a cool blue-white with a deep
   * blue band — not the cream used on the main 4-storey slab. Classic Philippine
   * public-school palette, taken from the campus photographs.
   */
  M.dctBlueWall = STD({
    map: T.stucco('#e8eef2', { seed: 44, dirt: 0.3 }), color: 0xdfe8ee,
    roughness: 0.72, emissive: 0x1c2226, emissiveIntensity: 0.12,
  });
  M.dctBlueBand = STD({ map: T.stucco('#2f5f96', { seed: 45, dirt: 0.2 }), roughness: 0.66 });
  M.dctBlueTrim = STD({ map: T.stucco('#f6f9fa', { seed: 46, dirt: 0.18 }), roughness: 0.6 });
  // Blue pre-painted long-run sheet — the second colour these blocks read as.
  M.dctRoofBlue = STD({ map: T.ribbedRoof('#2c4f7c'), roughness: 0.6, metalness: 0.18 });
  /**
   * Corridor soffits and walkway floors sit in permanent shade under the slab
   * above, so they need the same interreflection stand-in the shrine interior
   * uses or they render as a black tunnel.
   */
  M.dctTerrazzo = STD({
    map: T.floorTile('#c9c2b4', '#a8a091'), roughness: 0.42, metalness: 0.03,
    emissive: 0x2a2a28, emissiveIntensity: 0.26,
  });
  /**
   * Corridor soffit.
   *
   * This was near-white (#cfd6d8) with a strong blue-grey emissive, and in every
   * open-corridor view the ceiling panels blew out to the same value as the sky —
   * so the walkways read as open voids with sky showing through the floors.
   * A soffit under a slab is in shadow: it should be the darkest surface in the
   * corridor, and the lighting that makes the walkway readable comes from the
   * fittings hung under it, not from the soffit glowing.
   */
  M.dctSoffit = STD({
    map: T.stucco('#8d9497', { seed: 47, dirt: 0.45 }), roughness: 0.88,
    emissive: 0x1d2226, emissiveIntensity: 0.16,
  });
  M.windowGlassN = STD({
    color: 0x2b3a44, roughness: 0.16, metalness: 0.55,
    emissive: 0x18242c, emissiveIntensity: 0.4,
  });

  /* --------------------------------------------------- CLASSROOM FITTINGS */
  // Enclosed rooms with no window in the light grid, so every one of these
  // carries the emissive stand-in — otherwise the room renders as a black hole
  // behind its own open door.
  M.classroomFloor = STD({
    map: T.floorTile('#b9a279', '#9b8659'), roughness: 0.5,
    emissive: 0x2e2a22, emissiveIntensity: 0.30,
  });
  M.classroomCeil = STD({
    map: T.stucco('#eef0ee', { seed: 48, dirt: 0.18 }), roughness: 0.9,
    emissive: 0x3a3c3c, emissiveIntensity: 0.30,
  });
  M.classroomWall = STD({
    map: T.stucco('#e8e4d6', { seed: 49, dirt: 0.3 }), roughness: 0.88,
    emissive: 0x333029, emissiveIntensity: 0.28,
  });
  M.chalkboard = STD({
    map: T.stucco('#2f4536', { seed: 50, dirt: 0.15 }), roughness: 0.72,
    emissive: 0x121a14, emissiveIntensity: 0.34,
  });
  M.deskTop = STD({
    map: T.wood('#9a7448'), roughness: 0.6,
    emissive: 0x2a2014, emissiveIntensity: 0.28,
  });
  M.deskFrame = STD({ color: 0x6d7278, roughness: 0.55, metalness: 0.45 });
  M.fluorescent = STD({
    color: 0xf2f6ee, emissive: 0xe8f0e0, emissiveIntensity: 1.5, roughness: 0.4,
  });
  M.clockFace = STD({
    color: 0xf4f2ea, roughness: 0.5, emissive: 0x8a8a80, emissiveIntensity: 0.3,
  });

  /* ------------------------------------------------------ SHRINE INTERIOR */
  /**
   * The nave is a closed masonry box: no sun, no skylight, and only two point
   * lights inside it. Two lights cannot fill a room this size on their own, so
   * every interior surface carries a small emissive term standing in for
   * interreflection. That is a deliberate cheat, not an accident — without it
   * the interior renders as a black cave.
   *
   * The ceiling boarding needs the strongest lift of all: it is lit only from
   * below, shadowed by its own trusses, and is the largest bright surface in the
   * room, so it dominates the tone curve.
   */
  M.sanctuaryFloor = STD({
    // Warm stone. The emissive is the interreflection stand-in: with only two
    // point lights in the box and no bounce, a dark albedo alone reads as a
    // black pit, which is what removing the old pale shell floor exposed.
    map: T.graniteTile('#8a6c48'), color: 0xb59a76, roughness: 0.68, metalness: 0.0,
    emissive: 0x9c8460, emissiveIntensity: 0.55,
  });
  M.carpetRed = STD({
    map: T.stucco('#7d1d20', { seed: 73, dirt: 0.35 }), color: 0xd8b0b0,
    roughness: 0.96, emissive: 0x4a1214, emissiveIntensity: 0.30,
  });
  M.interiorPlaster = STD({
    map: T.stucco('#efe7d6', { seed: 5, dirt: 0.5 }), color: 0xc2cdd4,
    roughness: 0.9, emissive: 0x5a6470, emissiveIntensity: 0.30,
  });
  M.interiorDado = STD({
    map: T.wood('#4b2a14'), roughness: 0.62,
    emissive: 0x3a2814, emissiveIntensity: 0.40,
  });
  // Piers reuse the rock map rather than regenerating a texture at a new hex —
  // the memo key includes the hex, so a new tint means a whole new texture.
  M.interiorPier = STD({
    map: M.rockFace.map, color: 0x8a7f70, roughness: 0.85,
    emissive: 0x2a2620, emissiveIntensity: 0.30,
  });
  M.altarDark = STD({
    map: T.wood('#3a1a10'), roughness: 0.55,
    emissive: 0x1e0f08, emissiveIntensity: 0.22,
  });
  M.altarNiche = STD({
    map: T.stucco('#8e2a34', { seed: 71, dirt: 0.25 }), roughness: 0.7,
    emissive: 0x2e0d12, emissiveIntensity: 0.28,
  });
  M.goldCross = STD({
    color: 0xe8c063, roughness: 0.26, metalness: 0.9,
    emissive: 0x8a6418, emissiveIntensity: 0.55,
  });
  M.goldRay = STD({
    color: 0xf2d288, roughness: 0.22, metalness: 0.9,
    emissive: 0x7a5a1c, emissiveIntensity: 0.55,
  });
  M.altarMarble = STD({ map: T.graniteTile('#ddd8cf'), roughness: 0.28, metalness: 0.04 });
  M.altarCloth = STD({ map: T.stucco('#f0ece0', { seed: 74, dirt: 0.15 }), roughness: 0.85, emissive: 0x4a4840, emissiveIntensity: 0.2 });
  M.candleWax = STD({ color: 0xf2ead6, roughness: 0.6, emissive: 0x4a4430, emissiveIntensity: 0.25 });
  M.pewWood = STD({
    map: T.wood('#6e4a2c'), roughness: 0.62,
    emissive: 0x4a3220, emissiveIntensity: 0.45,
  });
  /**
   * Ceiling boarding. The emissive is deliberately strong AND neutral: it is
   * the brightest large surface in the nave and is only ever lit from below, so
   * a weak or warm emissive turns the whole roof into a tan-brown mass and
   * destroys the contrast against the dark timber trusses.
   */
  M.ceilingBoard = STD({
    map: T.wood('#eef2f4'), roughness: 0.92, color: 0xffffff,
    emissive: 0xd6dade, emissiveIntensity: 0.62,
  });
  // Trusses must stay DARK against that boarding — that contrast is the whole
  // read of an exposed-truss roof.
  M.trussWood = STD({
    map: T.wood('#3a1f0e'), color: 0x5a4331, roughness: 0.8,
    emissive: 0x120c06, emissiveIntensity: 0.05,
  });
  M.windowGlow = STD({
    color: 0xfff4d8, emissive: 0xfff0cc, emissiveIntensity: 1.6, roughness: 0.4,
  });
  M.lampGlow = STD({
    color: 0xfff2d0, emissive: 0xffe9b8, emissiveIntensity: 1.1, roughness: 0.35,
  });

  /* ------------------------------------------- derived normal/roughness maps */
  /**
   * Assign relief by surface class, ordered by value per texture fetch. Rock and
   * timber gain most (their whole read IS texture); painted plaster gains a
   * little (it only has to stop looking like vinyl); glass and polished stone are
   * deliberately skipped, since a normal map on a mirror-flat surface only adds
   * noise.
   */
  enhance(M.rockFace, 3.2, { base: 0.95, swing: 0.16 });
  enhance(M.interiorPier, 2.8, { base: 0.86, swing: 0.18 });

  for (const k of ['wood', 'woodDark', 'pewWood', 'trussWood', 'deskTop',
                   'sanctuaryFloor', 'ceilingBoard', 'woodSoffit']) {
    if (M[k] && !M[k].normalMap) enhance(M[k], 1.5, { base: 0.74, swing: 0.2 });
  }
  for (const k of ['dctWall', 'dctBand', 'churchWall', 'churchDome',
                   'interiorPlaster', 'interiorDado', 'dctBlueWall',
                   'dctBlueBand', 'dctBlueTrim', 'dctSoffit', 'classroomWall',
                   'classroomCeil', 'paintWhite', 'paintCream',
                   'houseWallA', 'houseWallB']) {
    if (M[k] && !M[k].normalMap) enhance(M[k], 1.0, { base: 0.8, swing: 0.14 });
  }
  for (const k of ['concrete', 'concreteTrim', 'concreteDark', 'paving',
                   'pavingRed', 'tileCream', 'tileRed', 'dctTerrazzo']) {
    if (M[k] && !M[k].normalMap) enhance(M[k], 1.8, { base: 0.85, swing: 0.16 });
  }
  // Roof sheet: the ribs should catch the light.
  for (const k of ['roofRib', 'dctRoofBlue', 'galv']) {
    if (M[k] && !M[k].normalMap) enhance(M[k], 2.2, { base: 0.62, swing: 0.2 });
  }

  return M;
}

/** Emissive-night helper: swap some materials when the sun drops. */
export function makeNightVariants(M) {
  const night = {
    glass: STD({
      map: T.glazing('#20242a', 0.95), emissive: 0xffe2b0, emissiveIntensity: 0.9,
      emissiveMap: T.glazing('#20242a', 0.95), roughness: 0.1, metalness: 0.0,
    }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffdca8 }),
    signGlow: new THREE.MeshBasicMaterial({ color: 0x9fd8ff }),
  };
  return night;
}
