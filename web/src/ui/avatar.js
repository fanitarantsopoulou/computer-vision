// Cartoon kid shown instead of the pupil's real face. Arms (.arm-l / .arm-r), eyes and mouth are
// separate groups so CSS can pose them (see #avatar.pose-* in style.css).
const SKIN = "#ffd3a8";

// Distance between the two shoulder pivots, for sizing the avatar to the pupil (see body.js).
export const SHOULDER_UNITS = { boy: 100, girl: 76 };

// Arm pivots (shoulders) in viewBox units, left and right as seen by the viewer.
const pivot = (x) => `style="transform-origin:${x}px 150px;transform-box:view-box"`;

// Proportions of a ~10 year old: smaller head, longer arms and legs than a little kid.
const BOY = `
  <circle cx="59" cy="88" r="8" fill="${SKIN}"/><circle cx="141" cy="88" r="8" fill="${SKIN}"/>
  <rect x="92" y="118" width="16" height="26" fill="${SKIN}"/>
  <rect x="72" y="248" width="24" height="88" rx="8" fill="#2c3e73"/><rect x="104" y="248" width="24" height="88" rx="8" fill="#2c3e73"/>
  <path d="M62 250 L62 152 Q62 138 100 138 Q138 138 138 152 L138 250 Z" fill="#3f8cff"/>
  <g class="arm-l" ${pivot(50)}><rect x="42" y="145" width="16" height="84" rx="8" fill="#3f8cff"/><circle cx="50" cy="232" r="10" fill="${SKIN}"/></g>
  <g class="arm-r" ${pivot(150)}><rect x="142" y="145" width="16" height="84" rx="8" fill="#3f8cff"/><circle cx="150" cy="232" r="10" fill="${SKIN}"/></g>
  <circle cx="100" cy="85" r="40" fill="${SKIN}"/>
  <path d="M60 80 Q56 48 82 40 L86 24 L98 37 L108 20 L117 37 L131 28 L131 43 Q147 53 140 80 Q132 62 118 59 Q104 68 84 59 Q68 62 60 80 Z" fill="#4a2c12"/>`;

const GIRL = `
  <rect x="92" y="118" width="16" height="26" fill="${SKIN}"/>
  <rect x="76" y="248" width="18" height="88" rx="8" fill="${SKIN}"/><rect x="106" y="248" width="18" height="88" rx="8" fill="${SKIN}"/>
  <path d="M56 250 L74 150 Q74 138 100 138 Q126 138 126 150 L144 250 Z" fill="#ff6fa8"/>
  <g class="arm-l" ${pivot(62)}><rect x="54" y="145" width="16" height="84" rx="8" fill="#ff6fa8"/><circle cx="62" cy="232" r="10" fill="${SKIN}"/></g>
  <g class="arm-r" ${pivot(138)}><rect x="130" y="145" width="16" height="84" rx="8" fill="#ff6fa8"/><circle cx="138" cy="232" r="10" fill="${SKIN}"/></g>
  <circle cx="50" cy="96" r="16" fill="#7a3b12"/><circle cx="150" cy="96" r="16" fill="#7a3b12"/>
  <circle cx="100" cy="85" r="40" fill="${SKIN}"/>
  <path d="M58 84 Q56 38 100 40 Q144 38 142 84 Q126 56 100 58 Q74 56 58 84 Z" fill="#7a3b12"/>
  <circle cx="66" cy="54" r="8" fill="#ffd93b"/><circle cx="134" cy="54" r="8" fill="#ffd93b"/>`;

const FACE = `
  <g class="eyes"><circle cx="85" cy="85" r="5" fill="#222"/><circle cx="115" cy="85" r="5" fill="#222"/>
  <circle cx="86.5" cy="83.5" r="1.7" fill="#fff"/><circle cx="116.5" cy="83.5" r="1.7" fill="#fff"/></g>
  <circle cx="76" cy="99" r="6" fill="#ff9aa2" opacity="0.6"/><circle cx="124" cy="99" r="6" fill="#ff9aa2" opacity="0.6"/>
  <path class="mouth" d="M88 101 Q100 113 112 101" fill="none" stroke="#c0392b" stroke-width="3.5" stroke-linecap="round"/>`;

export function avatarSvg(kind) {
  return `<svg viewBox="0 0 200 340" aria-hidden="true">${kind === "boy" ? BOY : GIRL}${FACE}</svg>`;
}
