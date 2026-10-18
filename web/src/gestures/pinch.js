// Pinch with hysteresis and release debouncing, so a grab doesn't break on landmark jitter.
// Port of src/gesture_vision/gestures/pinch.py.

export class PinchDetector {
  constructor({ start = 0.3, release = 0.45, releaseFrames = 3 } = {}) {
    if (start >= release) throw new Error("start threshold must be below release threshold");
    this.start = start;
    this.release = release;
    this.releaseFrames = releaseFrames;
    this.active = false;
    this.openCount = 0;
  }

  /** Feed this frame's pinch distance (null = no hand). Returns whether the pinch is active. */
  update(distance) {
    if (distance == null) {
      this.reset();
    } else if (!this.active) {
      if (distance < this.start) {
        this.active = true;
        this.openCount = 0;
      }
    } else if (distance > this.release) {
      if (++this.openCount >= this.releaseFrames) this.reset();
    } else {
      this.openCount = 0;
    }
    return this.active;
  }

  reset() {
    this.active = false;
    this.openCount = 0;
  }
}
