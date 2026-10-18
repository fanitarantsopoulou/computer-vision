// Static cartoon background: blue sky, sun, soft clouds, green hills, a tree and flowers.
export const SCENE_SVG = `
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4fb3f6"/><stop offset="0.65" stop-color="#a9e0ff"/><stop offset="1" stop-color="#e3f6ff"/>
    </linearGradient>
    <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ed957"/><stop offset="1" stop-color="#4caf3d"/></linearGradient>
    <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc84a"/><stop offset="1" stop-color="#2f9b3a"/></linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff7a8"/><stop offset="0.6" stop-color="#ffe14d"/><stop offset="1" stop-color="#ffe14d" stop-opacity="0"/></radialGradient>
    <g id="puff"><ellipse cx="60" cy="50" rx="60" ry="30"/><ellipse cx="110" cy="38" rx="48" ry="34"/><ellipse cx="150" cy="52" rx="55" ry="26"/><ellipse cx="85" cy="30" rx="38" ry="28"/></g>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="190" cy="150" r="170" fill="url(#sun)"/>
  <circle cx="190" cy="150" r="62" fill="#ffd93b"/>
  <g fill="#fff" opacity="0.85">
    <use href="#puff" x="780" y="70" transform="scale(1)"/>
    <use href="#puff" x="1210" y="30" transform="scale(1)"/>
    <use href="#puff" x="430" y="250" transform="scale(0.7)" />
  </g>
  <path d="M0 640 C 220 540 420 560 640 620 S 1040 700 1250 600 S 1500 560 1600 600 V900 H0 Z" fill="url(#hill1)"/>
  <path d="M0 740 C 260 670 520 700 780 740 S 1250 790 1600 700 V900 H0 Z" fill="url(#hill2)"/>
  <g transform="translate(120 520)">
    <rect x="-14" y="40" width="28" height="120" rx="8" fill="#8b5a2b"/>
    <circle cx="0" cy="20" r="75" fill="#2e9a3f"/><circle cx="-55" cy="55" r="48" fill="#3aaf4a"/><circle cx="58" cy="55" r="48" fill="#3aaf4a"/>
    <circle cx="-25" cy="5" r="9" fill="#ff5c5c"/><circle cx="30" cy="30" r="9" fill="#ff5c5c"/><circle cx="-5" cy="50" r="9" fill="#ff5c5c"/>
  </g>
  <g>
    ${[
      [420, 800, "#ff6b9d"],
      [470, 830, "#ffd93b"],
      [740, 820, "#ffffff"],
      [1010, 790, "#ff6b9d"],
      [1060, 835, "#ffd93b"],
      [1330, 810, "#ffffff"],
    ]
      .map(
        ([x, y, c]) =>
          `<g transform="translate(${x} ${y})"><rect x="-2" y="0" width="4" height="26" fill="#2b7a2f"/><circle r="11" fill="${c}"/><circle r="4.5" fill="#ff9f1c"/></g>`,
      )
      .join("")}
  </g>
</svg>`;
