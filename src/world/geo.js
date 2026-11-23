/**
 * Geo-referencing for the Capas, Tarlac site.
 *
 * Everything in the world is authored in metres on a right-handed Y-up frame
 * whose origin sits at the main gate of Dominican College of Tarlac on
 * MacArthur Highway (N2).
 *
 *   +X  → east   (along MacArthur Hwy toward Tarlac City)
 *   +Z  → south  (toward Bamban / Clark)
 *   -Z  → north  (toward Capas Municipal Hall)
 *
 * WGS84 anchors came from OSM/Nominatim footprints; local offsets were then
 * refined against reference photographs and the campus boundary polygon.
 */

// WGS84 anchor: campus frontage on MacArthur Highway.
export const ORIGIN = {
  lat: 15.33248,
  lon: 120.59011,
  // Height of the site above sea level. Capas poblacion sits on the lahar
  // plain ~95 m AMSL; the plaza is essentially flat with a 0.4 m crown.
  alt: 0,
};

// Metres per degree at 15.33°N.
const M_PER_DEG_LAT = 110574.0;
const M_PER_DEG_LON = 111320.0 * Math.cos((ORIGIN.lat * Math.PI) / 180); // ≈ 107343

/** WGS84 → world metres (+X east, +Z south). */
export function geoToWorld(lat, lon) {
  return {
    x: (lon - ORIGIN.lon) * M_PER_DEG_LON,
    z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT,
  };
}

/** World metres → WGS84. */
export function worldToGeo(x, z) {
  return {
    lat: ORIGIN.lat - z / M_PER_DEG_LAT,
    lon: ORIGIN.lon + x / M_PER_DEG_LON,
  };
}

/**
 * Key surveyed points, converted from the OSM footprints.
 * Run tools/geom-note.txt values through this to sanity-check placement.
 */
export const SITE = {
  campus: {
    // Campus boundary polygon (osm way 154144493) in world metres.
    minX: -110.6, maxX: 51.5, minZ: -26.9, maxZ: 47.0,
  },
  church: {
    centerX: -74.0, centerZ: 0.0,
    // Nave footprint (osm way 154079331): ~47.9 m x 44.6 m overall incl. transept
    width: 47.9, depth: 44.6,
    naveWidth: 17.4, naveLength: 34.0,
  },
  bellTower: { x: -46.5, z: -17.5 },
  plaza:     { centerX: -29.0, centerZ: -56.0 },
  townHall:  { centerX: 21.0,  centerZ: -96.0 },
  market:    { centerX: 27.0,  centerZ: 44.0 },
};
