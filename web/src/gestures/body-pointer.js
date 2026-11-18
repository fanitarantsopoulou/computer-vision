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

/** body: 33 pose landmarks; vw, vh: camera frame; w, h: screen. Returns [{id, x, y}] for each raised hand. */
export function raisedHands(body, vw, vh, w, h) {
  const [ls, rs] = [body[11], body[12]];
  const seen = (p) => p && (p.visibility ?? 1) >= VISIBLE;
  if (!seen(ls) || !seen(rs) || ls.x - rs.x < MIN_SHOULDERS) return [];
  const span = (ls.x - rs.x) * vw;
  const mx = (ls.x + rs.x) / 2;
  const my = (ls.y + rs.y) / 2;
  const out = [];
  for (const { id, tip, wrist } of HANDS) {
    const p = seen(body[tip]) ? body[tip] : body[wrist];
    if (!seen(p)) continue;
    const dx = (-(p.x - mx) * vw) / span; // mirrored
    const dy = ((p.y - my) * vh) / span;
    if (dy > RAISED) continue;
    out.push({ id, x: clamp(CENTER_X * w + (dx / REACH) * 0.4 * w, w), y: clamp(SHOULDER_Y * h + dy * GAIN_Y * h, h) });
  }
  return out;
}
