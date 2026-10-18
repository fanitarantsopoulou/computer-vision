import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREFECTURES } from "../src/data/prefectures.js";
import { Deck } from "../src/game/deck.js";
import { PinchDetector } from "../src/gestures/pinch.js";

const map = JSON.parse(readFileSync(new URL("../src/data/greece-map.json", import.meta.url), "utf8"));

test("every regional unit on the map belongs to exactly one prefecture", () => {
  const owner = new Map();
  for (const p of PREFECTURES) {
    for (const u of p.units) {
      assert.ok(map.units[u], `${p.id}: unknown unit ${u}`);
      assert.ok(!owner.has(u), `${u} is in both ${owner.get(u)} and ${p.id}`);
      owner.set(u, p.id);
    }
  }
  const missing = Object.keys(map.units).filter((u) => !owner.has(u));
  assert.deepEqual(missing, []);
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
