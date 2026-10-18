// Per-frame hand features. Port of src/gesture_vision/features/geometry.py.
// `world` / `image` are arrays of 21 {x, y, z} as returned by MediaPipe.

export const L = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20,
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const FINGERS = [
  [L.INDEX_MCP, L.INDEX_TIP],
  [L.MIDDLE_MCP, L.MIDDLE_TIP],
  [L.RING_MCP, L.RING_TIP],
  [L.PINKY_MCP, L.PINKY_TIP],
];

/** Thumb tip to index tip, in palm units (wrist -> middle MCP == 1). ~0.1-0.2 when pinched. */
export function pinchDistance(world) {
  const palm = dist(world[L.WRIST], world[L.MIDDLE_MCP]) || 1e-6;
  return dist(world[L.THUMB_TIP], world[L.INDEX_TIP]) / palm;
}

/** Midpoint of thumb and index tips in image coordinates ([0, 1]). */
export function pinchPoint(image) {
  const a = image[L.THUMB_TIP];
  const b = image[L.INDEX_TIP];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** [index, middle, ring, pinky]: |wrist->tip| / |wrist->MCP|. ~2 extended, ~1 curled. */
export function fingerExtensions(world) {
  const w = world[L.WRIST];
  return FINGERS.map(([mcp, tip]) => dist(w, world[tip]) / (dist(w, world[mcp]) || 1e-6));
}

const CURLED_MAX = 1.25;
const EXTENDED_MIN = 1.6;

export function classifyPose(ext) {
  if (ext.every((e) => e < CURLED_MAX)) return "fist";
  if (ext.every((e) => e > EXTENDED_MIN)) return "open";
  return "other";
}

export const indexCurled = (ext) => ext[0] < CURLED_MAX;
