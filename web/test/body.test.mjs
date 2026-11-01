import test from "node:test";
import assert from "node:assert/strict";
import { BodyAvatar } from "../src/ui/body.js";

// Subject facing the camera: their left shoulder is on the right of the raw image (larger x).
function pose(over = {}) {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  body[11] = { x: 0.6, y: 0.4, visibility: 1 }; // left shoulder
  body[12] = { x: 0.4, y: 0.4, visibility: 1 }; // right shoulder
  body[15] = { x: 0.6, y: 0.7, visibility: 1 }; // left wrist, hanging
  body[16] = { x: 0.4, y: 0.7, visibility: 1 };
  Object.assign(body, over);
  return body;
}
const avatar = new BodyAvatar(null);
const target = (b) => avatar.target(b, 1000, 600, 1000, 600);

test("hanging arms point straight down", () => {
  const t = target(pose());
  assert.ok(Math.abs(t.l) < 1 && Math.abs(t.r) < 1);
});

test("raising the left arm sideways turns the avatar's screen-left arm 90deg clockwise", () => {
  const t = target(pose({ 15: { x: 0.8, y: 0.4, visibility: 1 } })); // out to the subject's left = larger raw x
  assert.ok(Math.abs(t.l - 90) < 1, t.l);
  assert.ok(Math.abs(t.r) < 1);
});

test("a hand above the head makes the arm point up", () => {
  const t = target(pose({ 16: { x: 0.4, y: 0.1, visibility: 1 } }));
  assert.ok(Math.abs(Math.abs(t.r) - 180) < 1, t.r);
});

test("the avatar sits between the shoulders and grows as the pupil comes closer", () => {
  const far = target(pose({ 11: { x: 0.55, y: 0.4, visibility: 1 }, 12: { x: 0.45, y: 0.4, visibility: 1 } }));
  const near = target(pose());
  assert.ok(Math.abs(near.x - 500) < 1 && Math.abs(near.y - 240) < 1);
  assert.ok(near.s > far.s);
});

test("no avatar for a body without visible shoulders or one far away", () => {
  assert.equal(target(pose({ 11: { x: 0.6, y: 0.4, visibility: 0.1 } })), null);
  assert.equal(target(pose({ 11: { x: 0.52, y: 0.4, visibility: 1 }, 12: { x: 0.48, y: 0.4, visibility: 1 } })), null);
});
