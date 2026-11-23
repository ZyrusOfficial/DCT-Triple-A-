// Fetches OSM data for the DCT/SNDT site via Overpass and writes a compact GeoJSON-ish JSON.
import fs from 'node:fs';
const BBOX = process.env.BBOX || '15.3295,120.5860,15.3360,120.5950';
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const Q = (bbox) => `[out:json][timeout:120];(
way["building"](${bbox});
way["highway"](${bbox});
way["leisure"](${bbox});
way["landuse"](${bbox});
way["amenity"](${bbox});
way["barrier"](${bbox});
way["natural"](${bbox});
way["waterway"](${bbox});
way["man_made"](${bbox});
node["amenity"](${bbox});
node["historic"](${bbox});
node["tourism"](${bbox});
node["man_made"](${bbox});
);out geom tags;`;

const body = Q(BBOX);
let json = null;
for (const url of ENDPOINTS) {
  try {
    const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(body), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DCT-3A-game-dev/0.1' } });
    if (!r.ok) { console.error(url, 'HTTP', r.status); continue; }
    const t = await r.text();
    if (!t.trim().startsWith('{')) { console.error(url, 'not json'); continue; }
    json = JSON.parse(t);
    console.error('OK from', url);
    break;
  } catch (e) { console.error(url, 'ERR', e.message); }
}
if (!json) { console.error('ALL ENDPOINTS FAILED'); process.exit(1); }
const out = { bbox: BBOX, ts: new Date().toISOString(), elements: json.elements || [] };
fs.writeFileSync('tools/data/osm-raw.json', JSON.stringify(out));
console.error('elements:', out.elements.length);
