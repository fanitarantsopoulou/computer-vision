// Pointers from the body pose, for when the pupil stands too far away for the hand model to see fingers.
// The raised hand is measured in shoulder widths from the shoulders, so it works at any distance.
const VISIBLE = 0.35;
const MIN_SHOULDERS = 0.03; // fraction of the frame width
const RAISED = 0.9; // a hand lower than this many shoulder widths below the shoulders is just hanging
const REACH = 2.2; // shoulder widths of sideways reach that cover the playing area
const CENTER_X = 0.43; // middle of the cloud band, as a fraction of the screen width
const SHOULDER_Y = 0.6; // where the shoulders map to on the screen
const GAIN_Y = 0.25; // screen heights per shoulder width of vertical reach
const HANDS = [
  { id: "body-l", tip: 19, wrist: 15 }, // the pupil's left hand is on the left of the mirrored screen
  { id: "body-r", tip: 20, wrist: 16 },
];

const clamp = (v, max) => Math.min(max, Math.max(0, v));

/** Where the shoulders are and how wide, from the pose; null when they are not seen well enough. */
export function reference(body, vw, vh) {
  const [ls, rs] = body ? [body[11], body[12]] : [];
  const seen = (p) => p && (p.visibility ?? 1) >= VISIBLE;
  if (!seen(ls) || !seen(rs) || ls.x - rs.x < MIN_SHOULDERS) return null;
  return { mx: (ls.x + rs.x) / 2, my: (ls.y + rs.y) / 2, span: (ls.x - rs.x) * vw, frac: ls.x - rs.x };
}

/** Screen position of a landmark {x, y} measured from the shoulders in shoulder widths (so distance does not matter), and that offset's dy. */
export function mapRelative(p, ref, vw, vh, w, h) {
  const dx = (-(p.x - ref.mx) * vw) / ref.span; // mirrored
  const dy = ((p.y - ref.my) * vh) / ref.span;
  return { x: clamp(CENTER_X * w + (dx / REACH) * 0.4 * w, w), y: clamp(SHOULDER_Y * h + dy * GAIN_Y * h, h), dy };
}

/** Below this shoulder width (fraction of the frame) the shoulder-relative mapping reaches further than the frame-wide one. */
export const FAR_SPAN = 0.138;

/** body: 33 pose landmarks; vw, vh: camera frame; w, h: screen. Returns [{id, x, y}] for each raised hand. */
export function raisedHands(body, vw, vh, w, h) {
  const ref = reference(body, vw, vh);
  if (!ref) return [];
  const out = [];
  for (const { id, tip, wrist } of HANDS) {
    const p = (body[tip]?.visibility ?? 1) >= VISIBLE ? body[tip] : body[wrist];
    if (!p || (p.visibility ?? 1) < VISIBLE) continue;
    const m = mapRelative(p, ref, vw, vh, w, h);
    if (m.dy > RAISED) continue;
    out.push({ id, x: m.x, y: m.y });
  }
  return out;
}
