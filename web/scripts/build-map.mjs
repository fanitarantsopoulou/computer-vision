// Builds src/data/greece-map.json: simplified SVG paths of Greece's 74 regional units.
// Source: OpenStreetMap (admin_level=6 inside Greece), via the Overpass API. (c) OpenStreetMap contributors, ODbL.
//
//   npm run build-map                 # downloads from Overpass
//   npm run build-map -- raw.json     # reuse a saved Overpass response
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import osmtogeojson from "osmtogeojson";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src", "data", "greece-map.json");

const QUERY =
  '[out:json][timeout:180];area["ISO3166-1"="GR"]->.g;rel(area.g)["boundary"="administrative"]["admin_level"="6"];out geom;';
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const WIDTH = 1000; // viewBox width
const TOLERANCE = 0.004; // Douglas-Peucker tolerance in degrees (~400 m)
const MIN_RING_SPAN = 0.025; // drop islets smaller than this (degrees)

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

const raw = process.argv[2] ? JSON.parse(await readFile(process.argv[2], "utf8")) : await fetchOverpass();
const geo = osmtogeojson(raw);

const units = [];
for (const f of geo.features) {
  const t = f.properties.tags ?? f.properties;
  if (t.admin_level !== "6" || !t["name:en"] || !/Polygon/.test(f.geometry.type)) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const xs = ring.map((p) => p[0]);
      const ys = ring.map((p) => p[1]);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (span < MIN_RING_SPAN) continue;
      const s = simplifyRing(ring, TOLERANCE);
      if (s.length >= 4) rings.push(s);
    }
  }
  units.push({ id: slug(t["name:en"]), name: t["name:el"] ?? t["name:en"], rings });
}
units.sort((a, b) => a.id.localeCompare(b.id));

const all = units.flatMap((u) => u.rings.flat());
const lat0 = (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2;
const k = Math.cos((lat0 * Math.PI) / 180);
const minX = Math.min(...all.map((p) => p[0]));
const maxY = Math.max(...all.map((p) => p[1]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const scale = WIDTH / ((maxX - minX) * k);
const height = Math.ceil((maxY - minY) * scale);
const fx = (n) => Math.round(n * 10) / 10;

const out = {
  viewBox: [0, 0, WIDTH, height],
  attribution: "© OpenStreetMap contributors (ODbL)",
  units: Object.fromEntries(
    units.map((u) => [
      u.id,
      {
        name: u.name,
        d: u.rings
          .map((r) => "M" + r.map(([lon, lat]) => `${fx((lon - minX) * k * scale)} ${fx((maxY - lat) * scale)}`).join("L") + "Z")
          .join(""),
      },
    ]),
  ),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
console.log(`${units.length} units, viewBox ${WIDTH}x${height}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB -> ${OUT}`);
