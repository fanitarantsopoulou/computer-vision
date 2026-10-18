// Builds src/data/greece-map.json: simplified SVG paths of the prefectures (νομοί) used by the game.
//
// Borders: OpenStreetMap regional units (admin_level=6) via the Overpass API, (c) OpenStreetMap contributors, ODbL.
//   OSM borders run out into the sea, so each prefecture is clipped to the real coastline:
// Coastline: GADM 4.1 level-1 polygons for Greece (https://gadm.org), which also give Mount Athos.
// Grouping: regional units -> prefectures comes from src/data/prefectures.js.
//
//   npm run build-map                              # downloads both sources
//   npm run build-map -- overpass.json gadm.json   # reuse saved copies
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import osmtogeojson from "osmtogeojson";
import polygonClipping from "polygon-clipping";
import { PREFECTURES } from "../src/data/prefectures.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src", "data", "greece-map.json");

const QUERY =
  '[out:json][timeout:180];area["ISO3166-1"="GR"]->.g;rel(area.g)["boundary"="administrative"]["admin_level"="6"];out geom;';
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const GADM_URL = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_GRC_1.json.zip";
const WIDTH = 1000; // viewBox width
const PRE_TOLERANCE = 0.001; // simplification before clipping, in degrees (~100 m): keeps the clipping fast
const TOLERANCE = 0.0025; // final simplification (~250 m)
const MIN_RING_SPAN = 0.02; // drop islets smaller than this (degrees)

async function fetchOverpass() {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": "gesture-vision-edu/0.1 (school project)", "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(QUERY),
        });
        if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) return await res.json();
        console.warn(`${url}: HTTP ${res.status}`);
      } catch (e) {
        console.warn(`${url}: ${e.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error("Overpass is unavailable; try again later or pass a saved response file.");
}

function slug(nameEn) {
  return nameEn
    .replace(/regional unit of/i, "")
    .replace(/regional unit/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Rings are closed (first == last), which makes Douglas-Peucker degenerate: split at the farthest point first.
function simplifyRing(ring, tol) {
  let m = 1;
  let best = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) {
      best = d;
      m = i;
    }
  }
  return [...simplify(ring.slice(0, m + 1), tol).slice(0, -1), ...simplify(ring.slice(m), tol)];
}

async function loadGadm(path) {
  if (path) return JSON.parse(await readFile(path, "utf8"));
  const res = await fetch(GADM_URL);
  if (!res.ok) throw new Error(`GADM: HTTP ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  return JSON.parse(strFromU8(Object.values(files)[0]));
}

const asMulti = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const simplifyMulti = (mp, tol, minSpan = 0) =>
  mp
    .map((poly) =>
      poly
        .map((ring) => ({ ring, span: spanOf(ring) }))
        .filter(({ span }) => span >= minSpan)
        .map(({ ring }) => simplifyRing(ring, tol))
        .filter((r) => r.length >= 4),
    )
    .filter((poly) => poly.length); // a polygon whose outer ring was dropped has no holes left either
function spanOf(ring) {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
const union = (parts) => (parts.length ? polygonClipping.union(...parts) : []);

const raw = process.argv[2] ? JSON.parse(await readFile(process.argv[2], "utf8")) : await fetchOverpass();
const gadm = await loadGadm(process.argv[3]);

// OSM regional units by id (e.g. "magnesia")
const unitGeo = new Map();
for (const f of osmtogeojson(raw).features) {
  const t = f.properties.tags ?? f.properties;
  if (t.admin_level !== "6" || !t["name:en"] || !/Polygon/.test(f.geometry.type)) continue;
  unitGeo.set(slug(t["name:en"]), simplifyMulti(asMulti(f.geometry), PRE_TOLERANCE));
}

// Real land: all GADM regions merged. Mount Athos is its own GADM region (OSM has no regional unit for it).
const land = union(gadm.features.map((f) => simplifyMulti(asMulti(f.geometry), PRE_TOLERANCE)));
const athosFeature = gadm.features.find((f) => f.properties.NAME_1 === "Athos" || f.properties.NAME_2 === "Athos");

const shapes = []; // {id, name, mp}
for (const p of PREFECTURES) {
  const parts = p.units.map((u) => {
    if (!unitGeo.has(u)) throw new Error(`${p.id}: no OSM regional unit "${u}"`);
    return unitGeo.get(u);
  });
  shapes.push({ id: p.id, mp: polygonClipping.intersection(union(parts), land) });
}
if (athosFeature) shapes.push({ id: "athos", mp: simplifyMulti(asMulti(athosFeature.geometry), PRE_TOLERANCE) });
for (const s of shapes) s.mp = simplifyMulti(s.mp, TOLERANCE, MIN_RING_SPAN);

const all = shapes.flatMap((s) => s.mp.flat(2));
const lat0 = (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2;
const k = Math.cos((lat0 * Math.PI) / 180);
const minX = Math.min(...all.map((p) => p[0]));
const maxY = Math.max(...all.map((p) => p[1]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const scale = WIDTH / ((maxX - minX) * k);
const height = Math.ceil((maxY - minY) * scale);
const fx = (n) => Math.round(n * 10) / 10;
const toPath = (mp) =>
  mp
    .flat()
    .map((r) => "M" + r.map(([lon, lat]) => `${fx((lon - minX) * k * scale)} ${fx((maxY - lat) * scale)}`).join("L") + "Z")
    .join("");

const out = {
  viewBox: [0, 0, WIDTH, height],
  attribution: "Borders © OpenStreetMap contributors (ODbL); coastline © GADM",
  shapes: Object.fromEntries(shapes.map((s) => [s.id, toPath(s.mp)])),
};

const empty = shapes.filter((s) => !s.mp.length).map((s) => s.id);
if (empty.length) throw new Error(`Empty after clipping: ${empty.join(", ")}`);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
console.log(`${shapes.length} shapes, viewBox ${WIDTH}x${height}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB -> ${OUT}`);
