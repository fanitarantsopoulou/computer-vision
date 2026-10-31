import MAP from "../data/greece-map.json";

const NS = "http://www.w3.org/2000/svg";

export class GreeceMap {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute("viewBox", MAP.viewBox.join(" "));
    svg.style.overflow = "visible"; // the arrow can poke out above the map
    this.paths = new Map();
    for (const [id, d] of Object.entries(MAP.shapes)) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", id === "athos" ? "unit athos" : "unit"); // Mount Athos is shown but is not a prefecture
      svg.appendChild(p);
      this.paths.set(id, p);
    }
  }

  /** Shows a bouncing arrow on the given prefecture. */
  point(id) {
    const [x, y] = MAP.anchors[id] ?? [];
    if (x === undefined) return;
    this.arrow ??= (() => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "arrow");
      g.innerHTML = '<g class="bob"><path d="M0 0 L-38 -58 H-15 V-130 H15 V-58 H38 Z"/></g>';
      return g;
    })();
    this.arrow.setAttribute("transform", `translate(${x} ${y})`);
    this.svg.appendChild(this.arrow); // on top of everything
  }

  hideArrow() {
    this.arrow?.remove();
  }

  /** Lights up the given prefecture ids; everything else is dimmed back. */
  light(ids = []) {
    this.hideArrow();
    const lit = new Set(ids);
    this.svg.classList.toggle("has-lit", lit.size > 0);
    for (const [id, p] of this.paths) {
      p.classList.toggle("lit", lit.has(id));
      if (lit.has(id)) this.svg.appendChild(p); // draw on top so the outline isn't covered by neighbours
    }
  }
}
