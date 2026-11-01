import { PinchDetector } from "./gestures/pinch.js";
import { classifyPose, fingerExtensions, indexCurled, pinchDistance, pinchPoint } from "./gestures/geometry.js";

const SMOOTHING = 0.35; // EMA weight of the previous cursor position
const MARGIN_X = 0.12; // the outer part of the camera view is unreachable with the hand; stretch the rest to the screen
const MARGIN_Y = 0.1;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const MATCH_FRACTION = 0.35; // a hand keeps its slot if it moved less than this fraction of the screen width since the last frame

/** The game's pointers, each {id, x, y, pinching, source} in screen pixels: up to two hands, or the mouse when no hand is seen. */
export class Pointer {
  constructor(target) {
    // One slot per hand; a hand is matched to the slot it was nearest to in the previous frame.
    this.slots = [0, 1].map(() => ({ pinch: new PinchDetector(), cursor: null, state: null }));
    this.handSeenAt = -Infinity;
    this.mouse = { x: 0, y: 0, down: false, active: false, overUi: false };

    target.addEventListener("pointermove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
      this.mouse.overUi = !!e.target.closest("[data-ui]"); // buttons and panels are not part of the game
    });
    target.addEventListener("pointerdown", () => (this.mouse.down = true));
    addEventListener("pointerup", () => (this.mouse.down = false));
  }

  /** Feed the tracker's hands (possibly none) for this frame. */
  updateHands(hands, nowMs, width, height) {
    const items = hands.map((hand) => {
      const p = pinchPoint(hand.image);
      return {
        hand,
        x: clamp01((1 - p.x - MARGIN_X) / (1 - 2 * MARGIN_X)) * width, // 1 - x: selfie view
        y: clamp01((p.y - MARGIN_Y) / (1 - 2 * MARGIN_Y)) * height,
      };
    });

    // Greedy matching: closest (hand, slot) pairs first; whatever is left takes a free slot.
    const pairs = [];
    items.forEach((it, i) =>
      this.slots.forEach((s, j) => s.cursor && pairs.push({ i, j, d: Math.hypot(it.x - s.cursor.x, it.y - s.cursor.y) })),
    );
    pairs.sort((a, b) => a.d - b.d);
    const slotOf = new Map(); // item index -> slot index
    const taken = new Set();
    for (const { i, j, d } of pairs) {
      if (d > MATCH_FRACTION * width || slotOf.has(i) || taken.has(j)) continue;
      slotOf.set(i, j);
      taken.add(j);
    }
    items.forEach((_, i) => {
      if (slotOf.has(i)) return;
      const j = this.slots.findIndex((s, k) => !taken.has(k) && !s.cursor);
      const any = j >= 0 ? j : this.slots.findIndex((_s, k) => !taken.has(k));
      if (any >= 0) {
        slotOf.set(i, any);
        taken.add(any);
      }
    });

    this.slots.forEach((slot, j) => {
      const i = [...slotOf].find(([, k]) => k === j)?.[0];
      if (i === undefined) {
        slot.pinch.update(null);
        slot.cursor = null;
        slot.state = null;
        return;
      }
      const { hand, x, y } = items[i];
      this.handSeenAt = nowMs;
      const ext = fingerExtensions(hand.world);
      const pose = classifyPose(ext);
      // In a fist the thumb rests on the index finger; that is not a pinch.
      const blocked = pose === "fist" || indexCurled(ext);
      const pinching = slot.pinch.update(blocked ? Infinity : pinchDistance(hand.world));
      slot.cursor = slot.cursor
        ? { x: SMOOTHING * slot.cursor.x + (1 - SMOOTHING) * x, y: SMOOTHING * slot.cursor.y + (1 - SMOOTHING) * y }
        : { x, y };
      slot.state = { id: j, ...slot.cursor, pinching, pose, source: "hand" };
    });
  }

  /** Current pointers: the hands when any was seen recently, otherwise the mouse (for testing and no-camera setups). */
  getAll(nowMs) {
    const hands = nowMs - this.handSeenAt < 300 ? this.slots.filter((s) => s.state).map((s) => s.state) : [];
    if (hands.length) return hands;
    if (this.mouse.active && !this.mouse.overUi) return [{ id: "mouse", x: this.mouse.x, y: this.mouse.y, pinching: this.mouse.down, source: "mouse" }];
    return [];
  }
}
