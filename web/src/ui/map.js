import MAP from "../data/greece-map.json";

const NS = "http://www.w3.org/2000/svg";

export class GreeceMap {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute("viewBox", MAP.viewBox.join(" "));
    this.paths = new Map();
    for (const [id, unit] of Object.entries(MAP.units)) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", unit.d);
      p.setAttribute("class", "unit");
      svg.appendChild(p);
      this.paths.set(id, p);
    }
  }

  /** Lights up the given regional unit ids; everything else is dimmed back. */
  light(unitIds = []) {
    const lit = new Set(unitIds);
    this.svg.classList.toggle("has-lit", lit.size > 0);
    for (const [id, p] of this.paths) {
      p.classList.toggle("lit", lit.has(id));
      if (lit.has(id)) this.svg.appendChild(p); // draw on top so the outline isn't covered by neighbours
    }
  }
}
