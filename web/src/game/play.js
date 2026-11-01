import { Deck } from "./deck.js";

const DWELL_S = 0.6; // hold an open hand over a cloud this long to pick it
const NEXT_ROUND_S = 3.5; // long enough to see the arrow on the map
const CLOUDS = 6; // one right answer and five wrong ones
const SIZE_LANES = 3; // clouds are sized as if the band held this many side by side
const SLOT_WEIGHTS = [0.6, 0.9, 1.3, 1.5, 1.4]; // where a cloud can fall across the band; the middle and the map side are likelier
const SPACING = 1.5; // vertical gap between consecutive clouds, in cloud heights
const SPEED = 0.11; // fall speed at the default setting, in screen heights per second (the teacher scales it)
const WRONG_COOLDOWN_S = 1.4;
const WRONG_MESSAGES = ["Προσπάθησε ξανά!", "Σχεδόν! Δοκίμασε ξανά.", "Ωχ! Ξαναπροσπάθησε!"];
const CHEERS = ["Μπράβο!", "Σωστά!", "Εξαιρετικά!", "Τα κατάφερες!"];

const CLOUD_PATH =
  "M50 118 C18 118 6 92 26 78 C16 52 44 36 66 48 C76 18 124 14 140 42 C168 30 200 50 190 76 C214 86 206 118 178 118 Z";
const cloudSvg = `<svg viewBox="0 0 220 130" preserveAspectRatio="none" aria-hidden="true"><path d="${CLOUD_PATH}"/></svg>`;

/** The falling-clouds quiz: DOM clouds, hit-testing, dwell/pinch selection and feedback. */
export class Play {
  constructor({ prefectures, map, els, sfx }) {
    this.sfx = sfx; // {win(), wrong()}
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
    this.paused = false;
    this.rounds = 0;
    this.speed = 1; // multiplier set from the teacher's speed slider
    this.nextIn = 0;
    this.bubbleIn = 0;
    this.time = 0;
    this.wasPinching = new Set(); // ids of the pointers that were pinching last frame
    this.size = { w: innerWidth, h: innerHeight };
  }

  /** Begins a session of `rounds` questions for the (optional) pupil name. */
  start({ rounds, name = "" }) {
    this.score = 0;
    this.asked = 0;
    this.total = rounds;
    this.rounds = rounds;
    this.paused = false;
    this.pupil = name;
    this.newRound();
    if (name) this.say(`Γεια σου, ${name}!`, true, 2.5);
  }

  /** Same pupil, same number of questions, from the first one. */
  restart() {
    this.stop();
    this.start({ rounds: this.rounds, name: this.pupil });
  }

  /** Moves on to the next question without counting this one as right. */
  skip() {
    if (!this.round) return;
    if (this.asked >= this.total) this.finish();
    else this.newRound();
  }

  stop() {
    this.pose(null);
    this.clouds.forEach((c) => c.el.remove());
    this.clouds = [];
    this.round = null;
    this.map.light([]);
    this.els.caption.textContent = "Πού βρίσκεται;";
    this.hideBubble();
  }

  resize(w, h) {
    this.size = { w, h };
    const cw = Math.min(240, Math.max(130, ((w * 0.46) / SIZE_LANES) * 0.82));
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
    return this.size.w * 0.2;
  }

  get playWidth() {
    return this.size.w * 0.46;
  }

  get ground() {
    return this.size.h * 0.7; // clouds are respawned at the top once they reach the grass
  }

  newRound() {
    this.pose(null);
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
      return { el, span, label, slot: 0, x: 0, y: 0, w: 0, h: 0, phase: Math.random() * 6.28, dwell: 0, cooldown: 0, state: "fall" };
    });
    this.resize(this.size.w, this.size.h);
    let prev = null;
    this.clouds.forEach((c, i) => {
      c.y = -c.h * (1 + i * SPACING); // staggered entry from above, each cloud in its own row
      c.slot = this.pickSlot(prev);
      prev = c.slot;
    });
  }

  /** A random horizontal slot, at least two slots away from the cloud just above/below so neighbours never sit side by side. */
  pickSlot(prevSlot) {
    const ok = SLOT_WEIGHTS.map((w, s) => (prevSlot === null || Math.abs(s - prevSlot) >= 2 ? w : 0));
    let r = Math.random() * ok.reduce((a, b) => a + b, 0);
    for (let s = 0; s < ok.length; s++) if ((r -= ok[s]) < 0) return s;
    return Math.floor(SLOT_WEIGHTS.length / 2);
  }

  respawn(c) {
    // Re-enter above the highest cloud, so no two clouds are ever side by side at the same height.
    const top = Math.min(...this.clouds.filter((o) => o !== c).map((o) => o.y), Infinity);
    c.y = Math.min(-c.h, top - c.h * SPACING);
    const above = this.clouds.filter((o) => o !== c).reduce((a, b) => (b.y < a.y ? b : a), { y: Infinity });
    c.slot = this.pickSlot(above.slot ?? null);
    c.state = "fall";
    c.el.classList.remove("wrong");
  }

  /** pointers: [{id, x, y, pinching}] (any number, e.g. both hands). dt in seconds. */
  update(dt, pointers) {
    if (this.paused) return;
    this.time += dt;
    if (this.bubbleIn > 0 && (this.bubbleIn -= dt) <= 0) this.hideBubble();
    if (this.locked) {
      if ((this.nextIn -= dt) <= 0) {
        if (this.asked >= this.total) this.finish();
        else this.newRound();
      }
      this.place(dt, []);
      return;
    }
    this.place(dt, pointers);
  }

  place(dt, pointers) {
    const speed = this.size.h * SPEED * this.speed;
    const slotW = this.playWidth / SLOT_WEIGHTS.length;
    const hits = pointers.map(() => ({ cloud: null, best: Infinity })); // the cloud under each pointer

    for (const c of this.clouds) {
      if (c.state === "fall" || c.state === "wrong") {
        c.y += speed * dt;
        if (c.y > this.ground) this.respawn(c);
      }
      if (c.cooldown > 0) c.cooldown -= dt;
      const cx = this.playLeft + slotW * (c.slot + 0.5) + Math.sin(this.time * 0.6 + c.phase) * slotW * 0.1;
      c.x = cx;
      c.el.style.transform = `translate(${cx - c.w / 2}px, ${c.y}px)`;

      if (c.state === "fall" && c.cooldown <= 0 && c.y > -c.h * 0.3) {
        pointers.forEach((pointer, k) => {
          const dx = (pointer.x - cx) / (c.w * 0.62);
          const dy = (pointer.y - (c.y + c.h / 2)) / (c.h * 0.7);
          const d = dx * dx + dy * dy;
          if (d <= 1 && d < hits[k].best) hits[k] = { cloud: c, best: d };
        });
      }
    }

    const pinching = new Set(pointers.filter((p) => p.pinching).map((p) => p.id));
    let chosen = null;
    for (const c of this.clouds) {
      const over = pointers.filter((_, k) => hits[k].cloud === c);
      c.el.classList.toggle("hover", over.length > 0);
      c.dwell = over.some((p) => !p.pinching) ? c.dwell + dt : Math.max(0, c.dwell - dt * 2);
      c.el.style.setProperty("--dwell", Math.min(1, c.dwell / DWELL_S));
      const pinchStart = over.some((p) => p.pinching && !this.wasPinching.has(p.id));
      if (!chosen && over.length && (pinchStart || c.dwell >= DWELL_S)) chosen = c;
    }
    this.wasPinching = pinching;
    if (chosen) this.choose(chosen);
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
      this.map.point(this.round.prefecture.id);
      this.els.caption.textContent = `Νομός ${this.round.prefecture.name}`;
      if (this.attempts === 0) this.score += 1;
      this.showScore();
      this.say(`${CHEERS[this.asked % CHEERS.length]} ${cloud.label}`, true);
      this.sfx?.win();
      this.pose("win");
      this.poseTimer = setTimeout(() => this.pose("point"), 1300); // then show the pupil where it is
    } else {
      this.attempts += 1;
      cloud.state = "wrong";
      cloud.cooldown = WRONG_COOLDOWN_S;
      cloud.el.classList.add("wrong");
      setTimeout(() => this.round && this.respawn(cloud), 700);
      this.say(WRONG_MESSAGES[Math.floor(Math.random() * WRONG_MESSAGES.length)], false);
      this.sfx?.wrong();
      this.pose("oops");
      this.poseTimer = setTimeout(() => this.pose(null), 1200);
    }
  }

  /** Sets the avatar's pose: "win", "point", "oops" or null for the idle sway. */
  pose(name) {
    clearTimeout(this.poseTimer);
    const a = this.els.avatar;
    a.classList.remove("pose-win", "pose-point", "pose-oops");
    if (name) {
      void a.offsetWidth; // restart the animation if the same pose is set again
      a.classList.add(`pose-${name}`);
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
