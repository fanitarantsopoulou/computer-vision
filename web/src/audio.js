// All sound is synthesized with the Web Audio API, so there are no audio files to ship or license.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Background tune: C Am F G, twice. Each bar is a bass note plus a plucked arpeggio of the chord.
const BARS = [
  { bass: 48, chord: [72, 76, 79] },
  { bass: 45, chord: [69, 72, 76] },
  { bass: 53, chord: [72, 77, 81] },
  { bass: 55, chord: [71, 74, 79] },
];
const PATTERNS = [
  [0, 1, 2, 1, 0, 1, 2, 1],
  [2, 1, 0, 1, 2, 1, 0, 2],
];
const STEP_S = 0.25; // one eighth note (120 bpm)
const LOOKAHEAD_S = 0.4;

export class Sound {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  /** Browsers only allow audio after a click or key press; call this from one. */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  /** One enveloped note. */
  note(freq, start, dur, { type = "triangle", gain = 0.2, attack = 0.01 } = {}) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  // --- background music ---
  startMusic() {
    if (!this.ctx || this.timer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Pausing the game freezes the music where it is. */
  pauseMusic(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }

  schedule() {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      const bar = Math.floor(this.step / 8);
      const { bass, chord } = BARS[bar % BARS.length];
      const i = this.step % 8;
      const pattern = PATTERNS[Math.floor(bar / BARS.length) % PATTERNS.length];
      this.note(midi(chord[pattern[i]]), this.nextTime, 0.35, { gain: 0.05 });
      if (i === 0 || i === 4) this.note(midi(bass - 12), this.nextTime, 0.5, { type: "sine", gain: 0.09 });
      this.nextTime += STEP_S;
      this.step += 1;
    }
  }

  // --- effects ---
  /** Right answer: a short rising chime. */
  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) => this.note(midi(n), t + i * 0.09, 0.35, { type: "square", gain: 0.09 }));
    this.note(midi(84), t + 0.36, 0.5, { type: "triangle", gain: 0.12 });
  }

  /** Wrong answer: a low double "bzzt" buzzer. */
  wrong() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const at of [0, 0.2]) {
      this.note(110, t + at, 0.16, { type: "sawtooth", gain: 0.16, attack: 0.005 });
      this.note(116.5, t + at, 0.16, { type: "square", gain: 0.07, attack: 0.005 });
    }
  }

  /** End of a round of questions: a fanfare. */
  victory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [67, 72, 76, 79].forEach((n, i) => this.note(midi(n), t + i * 0.14, 0.3, { type: "square", gain: 0.1 }));
    [[72, 76, 79, 84], [74, 77, 81, 86], [76, 79, 84, 88]].forEach((chord, k) =>
      chord.forEach((n) => this.note(midi(n), t + 0.6 + k * 0.22, 0.45, { type: "triangle", gain: 0.07 })),
    );
    [72, 76, 79, 84].forEach((n) => this.note(midi(n), t + 1.3, 1.4, { type: "triangle", gain: 0.1, attack: 0.03 }));
    this.note(midi(60), t + 1.3, 1.4, { type: "sine", gain: 0.14 });
  }
}
