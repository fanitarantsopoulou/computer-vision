import { PinchDetector } from "./gestures/pinch.js";
import { classifyPose, fingerExtensions, indexCurled, pinchDistance, pinchPoint } from "./gestures/geometry.js";

const SMOOTHING = 0.5; // EMA weight of the previous cursor position
const MARGIN_X = 0.12; // the outer part of the camera view is unreachable with the hand; stretch the rest to the screen
const MARGIN_Y = 0.1;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** One pointer for the game: {x, y, pinching, source} in screen pixels, or null when nobody is pointing. */
export class Pointer {
  constructor(target) {
    this.pinch = new PinchDetector();
    this.hand = null; // last hand-derived state
    this.handSeenAt = -Infinity;
    this.mouse = { x: 0, y: 0, down: false, active: false };
    this.cursor = null;

    target.addEventListener("pointermove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    });
    target.addEventListener("pointerdown", () => (this.mouse.down = true));
    addEventListener("pointerup", () => (this.mouse.down = false));
  }

  /** Feed the tracker's hand (or null) for this frame. */
  updateHand(hand, nowMs, width, height) {
    if (!hand) {
      this.pinch.update(null);
      this.cursor = null;
      this.hand = null;
      return;
    }
    this.handSeenAt = nowMs;
    const ext = fingerExtensions(hand.world);
    const pose = classifyPose(ext);
    // In a fist the thumb rests on the index finger; that is not a pinch.
    const blocked = pose === "fist" || indexCurled(ext);
    const pinching = this.pinch.update(blocked ? Infinity : pinchDistance(hand.world));

    const p = pinchPoint(hand.image);
    const tx = clamp01((1 - p.x - MARGIN_X) / (1 - 2 * MARGIN_X)) * width; // 1 - x: selfie view
    const ty = clamp01((p.y - MARGIN_Y) / (1 - 2 * MARGIN_Y)) * height;
    this.cursor = this.cursor ? { x: SMOOTHING * this.cursor.x + (1 - SMOOTHING) * tx, y: SMOOTHING * this.cursor.y + (1 - SMOOTHING) * ty } : { x: tx, y: ty };
    this.hand = { ...this.cursor, pinching, pose };
  }

  /** Current pointer: the hand when it was seen recently, otherwise the mouse (for testing and no-camera setups). */
  get(nowMs) {
    if (this.hand && nowMs - this.handSeenAt < 300) return { ...this.hand, source: "hand" };
    if (this.mouse.active) return { x: this.mouse.x, y: this.mouse.y, pinching: this.mouse.down, source: "mouse" };
    return null;
  }
}
