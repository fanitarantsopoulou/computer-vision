import { SHOULDER_UNITS } from "./avatar.js";

// Makes the cartoon kid copy the pupil: it sits on the pupil's shoulders, is as wide as they are,
// and each arm points the way the pupil's shoulder -> wrist line does.
const VISIBLE = 0.5; // minimum landmark visibility
const MIN_SHOULDERS = 0.09; // narrower than this (fraction of the frame) is someone far away
const HOLD_S = 0.8; // keep the avatar this long after the body is lost
const FOLLOW = 14; // smoothing speed, per second
const REST = 4; // degrees the arms hang out when the wrist is not seen
const MIN_HEIGHT = 0.22; // avatar height limits, as a fraction of the screen height
const MAX_HEIGHT = 1.1;
const SVG_H = 340;
const NECK = [100, 150]; // the point between the shoulders in the avatar's drawing

const deg = (r) => (r * 180) / Math.PI;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

export class BodyAvatar {
  constructor(el) {
    this.el = el;
    this.kind = "girl";
    this.seenAt = -Infinity;
    this.pose = null; // smoothed {x, y, s, tilt, l, r}
    this.live = false;
  }

  /**
   * body: the 33 pose landmarks (or null); w, h: stage size; vw, vh: camera frame size.
   * Returns true while the avatar is following a body.
   */
  update(body, now, dt, w, h, vw, vh) {
    const t = body && this.target(body, w, h, vw, vh);
    if (t) this.seenAt = now / 1000;
    if (now / 1000 - this.seenAt > HOLD_S) {
      this.release();
      return false;
    }
    if (t) {
      const k = this.pose ? 1 - Math.exp(-FOLLOW * dt) : 1;
      const p = this.pose ?? t;
      this.pose = {
        x: p.x + (t.x - p.x) * k,
        y: p.y + (t.y - p.y) * k,
        s: p.s + (t.s - p.s) * k,
        tilt: p.tilt + wrap(t.tilt - p.tilt) * k,
        l: p.l + wrap(t.l - p.l) * k,
        r: p.r + wrap(t.r - p.r) * k,
      };
    }
    if (!this.pose) return false;
    const { x, y, s, tilt, l, r } = this.pose;
    this.live = true;
    this.el.classList.add("live");
    this.el.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${tilt}deg) translate(${-NECK[0]}px, ${-NECK[1]}px)`;
    this.el.querySelector(".arm-l")?.style.setProperty("rotate", `${l}deg`);
    this.el.querySelector(".arm-r")?.style.setProperty("rotate", `${r}deg`);
    return true;
  }

  /** Back to the plain corner avatar. */
  release() {
    if (!this.live && !this.pose) return;
    this.live = false;
    this.pose = null;
    this.el.classList.remove("live");
    this.el.style.transform = "";
    for (const a of this.el.querySelectorAll(".arm-l, .arm-r")) a.style.removeProperty("rotate");
  }

  target(body, w, h, vw, vh) {
    const [ls, rs] = [body[11], body[12]]; // the pupil's left shoulder appears on the left of the mirrored screen
    const seen = (p) => (p.visibility ?? 1) >= VISIBLE;
    const span = ls.x - rs.x; // > 0 when facing the camera
    if (!seen(ls) || !seen(rs) || Math.abs(span) < MIN_SHOULDERS) return null;

    const units = SHOULDER_UNITS[this.kind];
    const s = Math.min((MAX_HEIGHT * h) / SVG_H, Math.max((MIN_HEIGHT * h) / SVG_H, (Math.abs(span) * w) / units));
    const tilt = deg(Math.atan2((rs.y - ls.y) * vh, span * vw));
    // Screen angle of a hanging arm is 0; positive turns it clockwise (towards the screen's left side).
    const arm = (sh, wrist, side) => {
      if (!seen(wrist)) return side * REST;
      const dx = -(wrist.x - sh.x) * vw; // mirrored
      const dy = (wrist.y - sh.y) * vh;
      return wrap(deg(Math.atan2(-dx, dy)) - tilt);
    };
    return {
      x: (1 - (ls.x + rs.x) / 2) * w,
      y: ((ls.y + rs.y) / 2) * h,
      s,
      tilt,
      l: arm(ls, body[15], 1),
      r: arm(rs, body[16], -1),
    };
  }
}
