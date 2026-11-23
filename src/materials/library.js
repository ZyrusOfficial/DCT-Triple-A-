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

  M.paving = STD({ map: T.pavers('#998674'), roughness: 0.88 });
  // Plaza paving: a warmer, slightly darker tan than the campus yard, so the
  // town park reads differently from the school apron.
  M.pavingWarm = STD({ map: T.pavers('#8a7159'), roughness: 0.9 });
  M.pavingRed = STD({ map: T.pavers('#8e6250'), roughness: 0.88 });
  M.tileRed = STD({ map: T.floorTile('#ab4f39', '#83735f'), roughness: 0.46, metalness: 0.02 });
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
  M.gold = STD({ color: 0xb08a2e, roughness: 0.3, metalness: 0.92 });
  M.fabric = STD({ color: 0x6b1f2e, roughness: 0.9 });

  /* ------------------------------------------------------------ water etc */
  M.water = new THREE.MeshStandardMaterial({
    color: 0x6d8fa3, roughness: 0.06, metalness: 0.1,
    transparent: true, opacity: 0.82, envMapIntensity: 1.6,
  });

  for (const k of Object.keys(M)) {
    if (M[k].map) M[k].map.anisotropy = 8;
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
