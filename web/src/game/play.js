import { Deck } from "./deck.js";

const DWELL_S = 0.6; // hold an open hand over a cloud this long to pick it
const NEXT_ROUND_S = 2.4;
const CLOUDS = 6; // one right answer and five wrong ones
const LANES = 4;
const SPEED = 0.1; // fall speed, in screen heights per second
const WRONG_COOLDOWN_S = 1.4;
const WRONG_MESSAGES = ["Προσπάθησε ξανά!", "Σχεδόν! Δοκίμασε ξανά.", "Ωχ! Ξαναπροσπάθησε!"];
const CHEERS = ["Μπράβο!", "Σωστά!", "Εξαιρετικά!", "Τα κατάφερες!"];

const CLOUD_PATH =
  "M50 118 C18 118 6 92 26 78 C16 52 44 36 66 48 C76 18 124 14 140 42 C168 30 200 50 190 76 C214 86 206 118 178 118 Z";
const cloudSvg = `<svg viewBox="0 0 220 130" preserveAspectRatio="none" aria-hidden="true"><path d="${CLOUD_PATH}"/></svg>`;

/** The falling-clouds quiz: DOM clouds, hit-testing, dwell/pinch selection and feedback. */
export class Play {
  constructor({ prefectures, map, els }) {
    this.deck = new Deck(prefectures, { choices: CLOUDS });
    this.map = map;
    this.els = els; // {clouds, prompt, prefecture, bubble, avatar, caption, score}
    this.clouds = [];
    this.round = null;
    this.score = 0; // questions answered right on the first try
    this.total = Infinity;
    this.asked = 0;
    this.attempts = 0;
    this.pupil = "";
    this.onFinish = () => {};
    this.locked = false;
    this.nextIn = 0;
    this.bubbleIn = 0;
    this.time = 0;
    this.wasPinching = false;
    this.size = { w: innerWidth, h: innerHeight };
  }

  /** Begins a session of `rounds` questions for the (optional) pupil name. */
  start({ rounds, name = "" }) {
    this.score = 0;
    this.asked = 0;
    this.total = rounds;
    this.pupil = name;
    this.newRound();
    if (name) this.say(`Γεια σου, ${name}!`, true, 2.5);
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
    const cw = Math.min(230, Math.max(120, ((w * 0.49) / LANES) * 0.95));
    for (const c of this.clouds) {
      c.w = cw;
      c.h = cw * 0.6;
      c.el.style.width = `${c.w}px`;
      c.el.style.height = `${c.h}px`;
      // Shrink long single words (e.g. Αλεξανδρούπολη) so they stay inside the cloud.
      const longest = Math.max(...c.label.split(" ").map((x) => x.length));
      c.span.style.fontSize = `${Math.min(cw * 0.17, (cw * 0.84) / (longest * 0.62))}px`;
    }
  }

  // Clouds fall in a band toward the middle of the screen: far-left positions would push the hand out of the camera view.
  // The map card takes the right side.
  get playLeft() {
    return this.size.w * 0.13;
  }

  get playWidth() {
    return this.size.w * 0.49;
  }

  get ground() {
    return this.size.h * 0.7; // clouds are respawned at the top once they reach the grass
  }

  newRound() {
    this.round = this.deck.next();
    this.asked += 1;
    this.attempts = 0;
    this.showScore();
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
      return { el, span, label, lane: i % LANES, x: 0, y: 0, w: 0, h: 0, phase: Math.random() * 6.28, dwell: 0, cooldown: 0, state: "fall", y0: -(i * 0.2) };
    });
    this.resize(this.size.w, this.size.h);
    this.clouds.forEach((c) => {
      c.y = c.y0 * this.size.h - c.h; // staggered entry from above
    });
  }

  respawn(c) {
    // Re-enter above the highest cloud in the same lane so clouds don't overlap.
    const top = Math.min(...this.clouds.filter((o) => o !== c && o.lane === c.lane).map((o) => o.y), Infinity);
    c.y = Math.min(-c.h, top - c.h * 1.4);
    c.state = "fall";
    c.el.classList.remove("wrong");
  }

  /** pointer: {x, y, pinching} or null. dt in seconds. */
  update(dt, pointer) {
    this.time += dt;
    if (this.bubbleIn > 0 && (this.bubbleIn -= dt) <= 0) this.hideBubble();
    if (this.locked) {
      if ((this.nextIn -= dt) <= 0) {
        if (this.asked >= this.total) this.finish();
        else this.newRound();
      }
      this.place(dt, null);
      return;
    }
    this.place(dt, pointer);
  }

  place(dt, pointer) {
    const speed = this.size.h * SPEED;
    const laneW = this.playWidth / this.clouds.length;
    let hovered = null;
    let best = Infinity;

    for (const c of this.clouds) {
      if (c.state === "fall" || c.state === "wrong") {
        c.y += speed * dt;
        if (c.y > this.ground) this.respawn(c);
      }
      if (c.cooldown > 0) c.cooldown -= dt;
      const cx = this.playLeft + laneW * (c.lane + 0.5) + Math.sin(this.time * 0.6 + c.phase) * laneW * 0.08;
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
      this.map.light([this.round.prefecture.id]);
      this.els.caption.textContent = `Νομός ${this.round.prefecture.name}`;
      if (this.attempts === 0) this.score += 1;
      this.showScore();
      this.say(`${CHEERS[this.asked % CHEERS.length]} ${cloud.label}`, true);
      this.els.avatar.classList.remove("cheer");
      void this.els.avatar.offsetWidth; // restart the animation
      this.els.avatar.classList.add("cheer");
    } else {
      this.attempts += 1;
      cloud.state = "wrong";
      cloud.cooldown = WRONG_COOLDOWN_S;
      cloud.el.classList.add("wrong");
      setTimeout(() => this.round && this.respawn(cloud), 700);
      this.say(WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)], false);
    }
  }

  say(text, good, seconds = good ? NEXT_ROUND_S : 2) {
    const b = this.els.bubble;
    b.textContent = text;
    b.className = good ? "good" : "";
    b.hidden = false;
    this.bubbleIn = seconds;
  }

  hideBubble() {
    this.els.bubble.hidden = true;
    this.bubbleIn = 0;
  }

  showScore() {
    const who = this.pupil ? `${this.pupil} · ` : "";
    this.els.score.textContent = `${who}Ερώτηση ${Math.min(this.asked, this.total)}/${this.total} · ⭐ ${this.score}`;
  }

  finish() {
    const result = { score: this.score, total: this.total, name: this.pupil };
    this.stop();
    this.onFinish(result);
  }
}
