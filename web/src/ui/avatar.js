// Cartoon kid shown instead of the pupil's real face. Arms (.arm-l / .arm-r), eyes and mouth are
// separate groups so CSS can pose them (see #avatar.pose-* in style.css).
const SKIN = "#ffd3a8";

// Arm pivots (shoulders) in viewBox units, left and right as seen by the viewer.
const pivot = (x) => `style="transform-origin:${x}px 150px;transform-box:view-box"`;

const BOY = `
  <circle cx="49" cy="90" r="10" fill="${SKIN}"/><circle cx="151" cy="90" r="10" fill="${SKIN}"/>
  <path d="M60 255 L60 150 Q60 125 100 125 Q140 125 140 150 L140 255 Z" fill="#3f8cff"/>
  <rect x="70" y="255" width="26" height="40" rx="8" fill="#2c3e73"/><rect x="104" y="255" width="26" height="40" rx="8" fill="#2c3e73"/>
  <g class="arm-l" ${pivot(50)}><rect x="40" y="145" width="20" height="70" rx="10" fill="#3f8cff"/><circle cx="50" cy="218" r="12" fill="${SKIN}"/></g>
  <g class="arm-r" ${pivot(150)}><rect x="140" y="145" width="20" height="70" rx="10" fill="#3f8cff"/><circle cx="150" cy="218" r="12" fill="${SKIN}"/></g>
  <circle cx="100" cy="85" r="52" fill="${SKIN}"/>
  <path d="M50 80 Q46 42 78 31 L83 11 L97 28 L108 7 L117 28 L133 13 L134 33 Q156 46 150 80 Q140 58 120 55 Q104 66 80 54 Q60 58 50 80 Z" fill="#4a2c12"/>`;

const GIRL = `
  <path d="M55 255 L72 150 Q72 125 100 125 Q128 125 128 150 L145 255 Z" fill="#ff6fa8"/>
  <rect x="72" y="255" width="22" height="40" rx="8" fill="#ffd3a8"/><rect x="106" y="255" width="22" height="40" rx="8" fill="#ffd3a8"/>
  <g class="arm-l" ${pivot(62)}><rect x="52" y="145" width="20" height="70" rx="10" fill="#ff6fa8"/><circle cx="62" cy="218" r="12" fill="${SKIN}"/></g>
  <g class="arm-r" ${pivot(138)}><rect x="128" y="145" width="20" height="70" rx="10" fill="#ff6fa8"/><circle cx="138" cy="218" r="12" fill="${SKIN}"/></g>
  <circle cx="38" cy="95" r="20" fill="#7a3b12"/><circle cx="162" cy="95" r="20" fill="#7a3b12"/>
  <circle cx="100" cy="85" r="52" fill="${SKIN}"/>
  <path d="M48 85 Q46 28 100 30 Q154 28 152 85 Q132 50 100 52 Q68 50 48 85 Z" fill="#7a3b12"/>
  <circle cx="60" cy="52" r="9" fill="#ffd93b"/><circle cx="140" cy="52" r="9" fill="#ffd93b"/>`;

const FACE = `
  <g class="eyes"><circle cx="82" cy="85" r="6" fill="#222"/><circle cx="118" cy="85" r="6" fill="#222"/>
  <circle cx="84" cy="83" r="2" fill="#fff"/><circle cx="120" cy="83" r="2" fill="#fff"/></g>
  <circle cx="70" cy="102" r="8" fill="#ff9aa2" opacity="0.6"/><circle cx="130" cy="102" r="8" fill="#ff9aa2" opacity="0.6"/>
  <path class="mouth" d="M84 104 Q100 122 116 104" fill="none" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>`;

export function avatarSvg(kind) {
  return `<svg viewBox="0 0 200 300" aria-hidden="true">${kind === "boy" ? BOY : GIRL}${FACE}</svg>`;
}
