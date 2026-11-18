// The hand model looks at the whole frame squeezed into ~200 px, so a hand 2 m from the camera is only
// ~10 px wide and gets lost. Cropping the frame around the pupil's upper body makes it several times larger.
export const CROP_ASPECT = 4 / 3;
const VISIBLE = 0.35;
const MIN_SPAN = 0.02; // shoulders narrower than this (fraction of the frame width): too far for a useful crop
const WIDTH = 7.2; // crop size in shoulder widths (arms out to both sides, a hand held above the head)
const FULL_FRAME = 0.85; // a crop this large gains nothing: use the whole frame

/** Pixel box {x, y, w, h} of the video around the pupil's upper body (4:3), or null for "use the whole frame". */
export function cropFor(body, vw, vh) {
  const [ls, rs] = body ? [body[11], body[12]] : [];
  const seen = (p) => p && (p.visibility ?? 1) >= VISIBLE;
  if (!seen(ls) || !seen(rs) || ls.x - rs.x < MIN_SPAN) return null;
  const span = (ls.x - rs.x) * vw;
  let w = span * WIDTH;
  let h = w / CROP_ASPECT;
  if (w > vw * FULL_FRAME || h > vh * FULL_FRAME) return null;
  const cx = ((ls.x + rs.x) / 2) * vw;
  const cy = ((ls.y + rs.y) / 2) * vh - span * 0.7; // more room above the shoulders than below
  const x = Math.min(vw - w, Math.max(0, cx - w / 2));
  const y = Math.min(vh - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}

/** Moves the previous crop part of the way to the new one so the hand model is not shaken by every pose update. */
export function easeCrop(prev, next, k = 0.3) {
  if (!next) return null;
  if (!prev) return next;
  const mix = (a, b) => a + (b - a) * k;
  return { x: mix(prev.x, next.x), y: mix(prev.y, next.y), w: mix(prev.w, next.w), h: mix(prev.h, next.h) };
}

/** Brightness multiplier for a frame whose average pixel value (0-255) is `mean`: lifts dim rooms, leaves bright ones. */
export function gainFor(mean) {
  return Math.min(2.5, Math.max(1, 110 / Math.max(mean, 1)));
}

/** Landmarks measured inside the crop -> normalized coordinates of the whole frame. */
export function toFrame(landmarks, crop, vw, vh) {
  return landmarks.map((p) => ({ ...p, x: (crop.x + p.x * crop.w) / vw, y: (crop.y + p.y * crop.h) / vh }));
}
