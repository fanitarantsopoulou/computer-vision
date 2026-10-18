import { Deck } from "./deck.js";

const DWELL_S = 1.3; // hold an open hand over a cloud this long to pick it
const NEXT_ROUND_S = 3.2;
const WRONG_COOLDOWN_S = 1.4;
const WRONG_MESSAGES = ["Προσπάθησε ξανά!", "Σχεδόν! Δοκίμασε ξανά.", "Ωχ! Ξαναπροσπάθησε!"];
const CHEERS = ["Μπράβο!", "Σωστά!", "Εξαιρετικά!", "Τα κατάφερες!"];

const CLOUD_PATH =
  "M50 118 C18 118 6 92 26 78 C16 52 44 36 66 48 C76 18 124 14 140 42 C168 30 200 50 190 76 C214 86 206 118 178 118 Z";
const cloudSvg = `<svg viewBox="0 0 220 130" preserveAspectRatio="none" aria-hidden="true"><path d="${CLOUD_PATH}"/></svg>`;

/** The falling-clouds quiz: DOM clouds, hit-testing, dwell/pinch selection and feedback. */
export class Play {
  constructor({ prefectures, map, els }) {
    this.deck = new Deck(prefectures);
    this.map = map;
    this.els = els; // {clouds, prompt, prefecture, bubble, avatar, caption, score}
    this.clouds = [];
    this.round = null;
    this.score = 0;
    this.locked = false;
    this.nextIn = 0;
    this.bubbleIn = 0;
    this.time = 0;
    this.wasPinching = false;
    this.size = { w: innerWidth, h: innerHeight };
  }

  start() {
    this.score = 0;
    this.showScore();
    this.newRound();
  }

  stop() {
    this.clouds.forEach((c) => c.el.remove());
    this.clouds = [];
    this.round = null;
    this.map.light([]);
    this.els.caption.textContent = "Πού βρίσκεται;";
    this.hideBubble();
  }

  resize(w, h) {
    this.size = { w, h };
    const cw = Math.min(260, Math.max(150, w * 0.17));
    for (const c of this.clouds) {
      c.w = cw;
      c.h = cw * 0.6;
      c.el.style.width = `${c.w}px`;
      c.el.style.height = `${c.h}px`;
      c.span.style.fontSize = `${Math.max(18, cw * 0.15)}px`;
    }
  }

  get playWidth() {
    return this.size.w * 0.64; // the left part of the screen; the map card takes the right
  }

  get ground() {
    return this.size.h * 0.7; // clouds are respawned at the top once they reach the grass
  }

  newRound() {
    this.round = this.deck.next();
    this.locked = false;
    this.map.light([]);
    this.els.caption.textContent = "Πού βρίσκεται;";
    this.els.prefecture.textContent = this.round.prefecture.name;
    this.els.prompt.hidden = false;
    this.hideBubble();

    this.clouds.forEach((c) => c.el.remove());
    this.clouds = this.round.options.map((label, i) => {
      const el = document.createElement("div");
      el.className = "cloud";
      el.innerHTML = cloudSvg;
      const span = document.createElement("span");
      span.textContent = label;
      el.appendChild(span);
      this.els.clouds.appendChild(el);
      return { el, span, label, lane: i, x: 0, y: 0, w: 0, h: 0, phase: Math.random() * 6.28, dwell: 0, cooldown: 0, state: "fall", y0: -(i * 0.3) };
    });
    this.resize(this.size.w, this.size.h);
    this.clouds.forEach((c) => {
      c.y = c.y0 * this.size.h - c.h; // staggered entry from above
    });
  }

  respawn(c) {
    c.y = -c.h - Math.random() * this.size.h * 0.15;
    c.state = "fall";
    c.el.classList.remove("wrong");
  }

  /** pointer: {x, y, pinching} or null. dt in seconds. */
  update(dt, pointer) {
    this.time += dt;
    if (this.bubbleIn > 0 && (this.bubbleIn -= dt) <= 0) this.hideBubble();
    if (this.locked) {
      if ((this.nextIn -= dt) <= 0) this.newRound();
      this.place(dt, null);
      return;
    }
    this.place(dt, pointer);
  }

  place(dt, pointer) {
    const speed = this.size.h * 0.05;
    const laneW = this.playWidth / this.clouds.length;
    let hovered = null;
    let best = Infinity;

    for (const c of this.clouds) {
      if (c.state === "fall" || c.state === "wrong") {
        c.y += speed * dt;
        if (c.y > this.ground) this.respawn(c);
      }
      if (c.cooldown > 0) c.cooldown -= dt;
      const cx = laneW * (c.lane + 0.5) + Math.sin(this.time * 0.6 + c.phase) * laneW * 0.08;
      c.x = cx;
      c.el.style.transform = `translate(${cx - c.w / 2}px, ${c.y}px)`;

      if (pointer && c.state === "fall" && c.cooldown <= 0 && c.y > -c.h * 0.3) {
        const dx = (pointer.x - cx) / (c.w * 0.62);
        const dy = (pointer.y - (c.y + c.h / 2)) / (c.h * 0.7);
        const d = dx * dx + dy * dy;
        if (d <= 1 && d < best) {
          best = d;
          hovered = c;
        }
      }
    }

    const pinchStart = !!pointer?.pinching && !this.wasPinching;
    this.wasPinching = !!pointer?.pinching;
    for (const c of this.clouds) {
      const on = c === hovered;
      c.el.classList.toggle("hover", on);
      c.dwell = on && !pointer.pinching ? c.dwell + dt : Math.max(0, c.dwell - dt * 2);
      c.el.style.setProperty("--dwell", Math.min(1, c.dwell / DWELL_S));
    }
    if (hovered && (pinchStart || hovered.dwell >= DWELL_S)) this.choose(hovered);
  }

  choose(cloud) {
    cloud.dwell = 0;
    cloud.el.style.setProperty("--dwell", 0);
    cloud.el.classList.remove("hover");
    if (cloud.label === this.round.prefecture.capital) {
      this.locked = true;
      this.nextIn = NEXT_ROUND_S;
      cloud.state = "right";
      cloud.el.classList.add("right");
      for (const c of this.clouds) if (c !== cloud) c.el.classList.add("fade");
      this.map.light(this.round.prefecture.units);
      this.els.caption.textContent = `Νομός ${this.round.prefecture.name}`;
      this.score += 1;
      this.showScore();
      this.say(`${CHEERS[this.score % CHEERS.length]} ${cloud.label}`, true);
      this.els.avatar.classList.remove("cheer");
      void this.els.avatar.offsetWidth; // restart the animation
      this.els.avatar.classList.add("cheer");
    } else {
      cloud.state = "wrong";
      cloud.cooldown = WRONG_COOLDOWN_S;
      cloud.el.classList.add("wrong");
      setTimeout(() => this.round && this.respawn(cloud), 700);
      this.say(WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)], false);
    }
  }

  say(text, good) {
    const b = this.els.bubble;
    b.textContent = text;
    b.className = good ? "good" : "";
    b.hidden = false;
    this.bubbleIn = good ? NEXT_ROUND_S : 2;
  }

  hideBubble() {
    this.els.bubble.hidden = true;
    this.bubbleIn = 0;
  }

  showScore() {
    this.els.score.textContent = `⭐ ${this.score}`;
  }
}
