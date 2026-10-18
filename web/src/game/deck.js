// Question logic, free of any DOM so it can be unit tested.

export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deals each prefecture once per pass, in random order, never repeating one back to back across passes. */
export class Deck {
  constructor(prefectures, { rng = Math.random, choices = 3 } = {}) {
    if (prefectures.length < choices) throw new Error("not enough prefectures");
    this.prefectures = prefectures;
    this.rng = rng;
    this.choices = choices;
    this.queue = [];
    this.last = null;
  }

  next() {
    if (!this.queue.length) {
      this.queue = shuffle(this.prefectures, this.rng);
      if (this.queue[this.queue.length - 1] === this.last && this.queue.length > 1) this.queue.reverse();
    }
    const prefecture = this.queue.pop();
    this.last = prefecture;
    // Wrong answers are random capitals; skip duplicates by name (e.g. two prefectures sharing a capital name).
    const wrong = shuffle(this.prefectures.filter((p) => p.capital !== prefecture.capital), this.rng);
    const seen = new Set([prefecture.capital]);
    const options = [prefecture.capital];
    for (const p of wrong) {
      if (options.length === this.choices) break;
      if (!seen.has(p.capital)) {
        seen.add(p.capital);
        options.push(p.capital);
      }
    }
    return { prefecture, options: shuffle(options, this.rng) };
  }
}
