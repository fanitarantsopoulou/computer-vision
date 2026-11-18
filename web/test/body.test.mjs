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

test("no avatar for a body without visible shoulders or one too far away", () => {
  assert.equal(target(pose({ 11: { x: 0.6, y: 0.4, visibility: 0.1 } })), null);
  assert.equal(target(pose({ 11: { x: 0.51, y: 0.4, visibility: 1 }, 12: { x: 0.49, y: 0.4, visibility: 1 } })), null);
});

import { raisedHands } from "../src/gestures/body-pointer.js";

test("a raised hand gives a pointer, a hanging one does not", () => {
  const down = raisedHands(pose({ 19: { x: 0.6, y: 0.7, visibility: 1 }, 20: { x: 0.4, y: 0.7, visibility: 1 } }), 1000, 600, 1000, 600);
  assert.equal(down.length, 0);
  const up = raisedHands(pose({ 19: { x: 0.6, y: 0.7, visibility: 1 }, 20: { x: 0.4, y: 0.2, visibility: 1 } }), 1000, 600, 1000, 600);
  assert.equal(up.length, 1);
  assert.equal(up[0].id, "body-r");
});

test("body pointers work for a small, far-away pupil and follow the hand sideways", () => {
  const far = (handX) =>
    raisedHands(
      pose({
        11: { x: 0.52, y: 0.4, visibility: 1 },
        12: { x: 0.48, y: 0.4, visibility: 1 },
        20: { x: handX, y: 0.36, visibility: 1 },
      }),
      1000, 600, 1000, 600,
    )[0];
  const centre = far(0.48);
  const out = far(0.4); // the pupil's right hand moved away from the body = further right on the mirrored screen
  assert.ok(out.x > centre.x + 100, `${out.x} vs ${centre.x}`);
  assert.ok(out.x <= 1000 && out.y >= 0);
});

import { cropFor, easeCrop, gainFor, toFrame } from "../src/tracking/roi.js";

test("the hand crop is 4:3, inside the frame and centred on the shoulders", () => {
  const far = pose({ 11: { x: 0.54, y: 0.45, visibility: 1 }, 12: { x: 0.46, y: 0.45, visibility: 1 } });
  const c = cropFor(far, 1920, 1080);
  assert.ok(Math.abs(c.w / c.h - 4 / 3) < 1e-6);
  assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1920 && c.y + c.h <= 1080);
  assert.ok(c.x < 960 && c.x + c.w > 960); // the pupil is in the middle
  assert.ok(c.w < 1920 * 0.85);
});

test("no crop for a pupil close to the camera or a body that is not seen", () => {
  assert.equal(cropFor(pose(), 1920, 1080), null); // shoulders 20% wide: the whole frame is fine
  assert.equal(cropFor(null, 1920, 1080), null);
});

test("landmarks in the crop map back to the frame", () => {
  const [p] = toFrame([{ x: 0.5, y: 0.5, z: 0 }], { x: 100, y: 200, w: 800, h: 600 }, 1000, 1000);
  assert.ok(Math.abs(p.x - 0.5) < 1e-9 && Math.abs(p.y - 0.5) < 1e-9);
});

test("dim rooms are brightened, bright ones are not", () => {
  assert.equal(gainFor(200), 1);
  assert.ok(gainFor(40) > 2);
  assert.ok(gainFor(1) <= 2.5);
});

test("the crop eases towards a new position", () => {
  const e = easeCrop({ x: 0, y: 0, w: 100, h: 75 }, { x: 100, y: 0, w: 100, h: 75 });
  assert.ok(e.x > 0 && e.x < 100);
});
