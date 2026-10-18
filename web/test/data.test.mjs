import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREFECTURES } from "../src/data/prefectures.js";
import { Deck } from "../src/game/deck.js";
import { PinchDetector } from "../src/gestures/pinch.js";

const map = JSON.parse(readFileSync(new URL("../src/data/greece-map.json", import.meta.url), "utf8"));

test("the map has a shape for every prefecture (plus Mount Athos) and nothing else", () => {
  const ids = Object.keys(map.shapes).filter((id) => id !== "athos").sort();
  assert.deepEqual(ids, PREFECTURES.map((p) => p.id).sort());
  for (const d of Object.values(map.shapes)) assert.match(d, /^M[\d. L-]+Z/);
});

test("every OSM regional unit is assigned to exactly one prefecture", () => {
  const seen = new Set();
  for (const u of PREFECTURES.flatMap((p) => p.units)) {
    assert.ok(!seen.has(u), `${u} is in two prefectures`);
    seen.add(u);
  }
  assert.equal(seen.size, 74);
});

test("prefecture ids and names are unique", () => {
  assert.equal(new Set(PREFECTURES.map((p) => p.id)).size, PREFECTURES.length);
  assert.equal(new Set(PREFECTURES.map((p) => p.name)).size, PREFECTURES.length);
});

test("deck: 3 distinct options including the right capital; each prefecture once per pass", () => {
  const deck = new Deck(PREFECTURES);
  const seen = new Set();
  for (let i = 0; i < PREFECTURES.length; i++) {
    const { prefecture, options } = deck.next();
    assert.equal(options.length, 3);
    assert.equal(new Set(options).size, 3);
    assert.ok(options.includes(prefecture.capital));
    seen.add(prefecture.id);
  }
  assert.equal(seen.size, PREFECTURES.length);
});

test("pinch: hysteresis and release debounce", () => {
  const p = new PinchDetector({ start: 0.3, release: 0.45, releaseFrames: 3 });
  assert.equal(p.update(0.5), false);
  assert.equal(p.update(0.2), true);
  assert.equal(p.update(0.4), true); // between thresholds stays active
  assert.equal(p.update(0.6), true);
  assert.equal(p.update(0.6), true);
  assert.equal(p.update(0.6), false); // third open frame releases
  assert.equal(p.update(null), false);
});
