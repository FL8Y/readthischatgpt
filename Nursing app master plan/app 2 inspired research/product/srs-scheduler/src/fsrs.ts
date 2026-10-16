/**
 * Minimal FSRS spaced-repetition scheduler, written from the public FSRS-5 specification
 * (19 weights; the defaults below are the published FSRS-5 defaults).
 *
 * Parity warning: AnkiDroid 2.25.1's Rust backend bundles the `fsrs` crate 5.2.0 (observed in the
 * binary). That crate's version number suggests a newer FSRS generation than FSRS-5 (probably FSRS-6,
 * which has more weights and a trainable decay) - this is an inference, not verified. So this file
 * will NOT reproduce AnkiDroid's exact intervals. Use it as a small, dependency-free reference; for
 * exact parity use the ts-fsrs / fsrs-rs libraries, and fit the weights to your own review data.
 */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof Rating)[keyof typeof Rating];
export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type State = (typeof State)[keyof typeof State];

export const DEFAULT_W: readonly number[] = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // chosen so that retrievability(t = S) = 0.9
const DAY_MS = 86_400_000;

export interface Card {
  id: string;
  state: State;
  stability: number;   // days until retrievability falls to 90 %
  difficulty: number;  // 1 (easy) .. 10 (hard)
  due: Date;
  lastReview: Date | null;
  reps: number;
  lapses: number;
}

export interface Params {
  w: readonly number[];
  desiredRetention: number; // 0.7 .. 0.97, typical 0.9
  maximumIntervalDays: number;
  learningSteps: number[];   // minutes, before a card graduates to Review
}

export const DEFAULT_PARAMS: Params = {
  w: DEFAULT_W, desiredRetention: 0.9, maximumIntervalDays: 36500, learningSteps: [1, 10],
};

export function newCard(id: string, now = new Date()): Card {
  return { id, state: State.New, stability: 0, difficulty: 0, due: now, lastReview: null, reps: 0, lapses: 0 };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Probability the learner still remembers the card after `elapsedDays`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
}

/** Days until retrievability decays to `desiredRetention`. */
export function nextInterval(stability: number, p: Params): number {
  const raw = (stability / FACTOR) * (Math.pow(p.desiredRetention, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, p.maximumIntervalDays);
}

const initialStability = (g: Rating, w: readonly number[]) => Math.max(w[g - 1], 0.1);
const initialDifficulty = (g: Rating, w: readonly number[]) => clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);

function nextDifficulty(d: number, g: Rating, w: readonly number[]) {
  const delta = -w[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;               // linear damping toward 10
  const reverted = w[7] * initialDifficulty(Rating.Easy, w) + (1 - w[7]) * damped; // mean reversion
  return clamp(reverted, 1, 10);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: Rating, w: readonly number[]) {
  const hardPenalty = g === Rating.Hard ? w[15] : 1;
  const easyBonus = g === Rating.Easy ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
}

function stabilityAfterForget(d: number, s: number, r: number, w: readonly number[]) {
  const f = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  return Math.min(f, s); // a lapse never raises stability
}

const stabilityShortTerm = (s: number, g: Rating, w: readonly number[]) => s * Math.exp(w[17] * (g - 3 + w[18]));

/** Apply one review and return the updated card (the input is not mutated). */
export function review(card: Card, rating: Rating, now: Date, p: Params = DEFAULT_PARAMS): Card {
  const w = p.w;
  const next: Card = { ...card, reps: card.reps + 1, lastReview: now };
  const elapsedDays = card.lastReview ? Math.max(0, (now.getTime() - card.lastReview.getTime()) / DAY_MS) : 0;

  if (card.state === State.New) {
    next.stability = initialStability(rating, w);
    next.difficulty = initialDifficulty(rating, w);
  } else {
    const r = retrievability(elapsedDays, card.stability);
    next.difficulty = nextDifficulty(card.difficulty, rating, w);
    if (elapsedDays < 1) next.stability = stabilityShortTerm(card.stability, rating, w);
    else if (rating === Rating.Again) next.stability = stabilityAfterForget(next.difficulty, card.stability, r, w);
    else next.stability = stabilityAfterRecall(next.difficulty, card.stability, r, rating, w);
  }
  next.stability = Math.max(next.stability, 0.01);

  // Scheduling: short steps while (re)learning, FSRS interval once the card is in Review.
  const stepMs = (m: number) => m * 60_000;
  const steps = p.learningSteps;
  if (rating === Rating.Again) {
    if (card.state === State.Review || card.state === State.Relearning) { next.state = State.Relearning; next.lapses = card.lapses + 1; }
    else next.state = State.Learning;
    next.due = new Date(now.getTime() + stepMs(steps[0] ?? 1));
  } else if (card.state === State.New || card.state === State.Learning || card.state === State.Relearning) {
    if (rating === Rating.Easy || steps.length < 2) {
      next.state = State.Review;
      next.due = new Date(now.getTime() + nextInterval(next.stability, p) * DAY_MS);
    } else if (rating === Rating.Hard) {
      next.state = card.state === State.New ? State.Learning : card.state;
      next.due = new Date(now.getTime() + stepMs(steps[0]));
    } else { // Good: graduate after the last step
      next.state = State.Review;
      next.due = new Date(now.getTime() + Math.max(stepMs(steps[steps.length - 1]), nextInterval(next.stability, p) * DAY_MS));
    }
  } else {
    next.state = State.Review;
    next.due = new Date(now.getTime() + nextInterval(next.stability, p) * DAY_MS);
  }
  return next;
}

/** Preview the due date each button would produce (for the four answer buttons). */
export function preview(card: Card, now: Date, p: Params = DEFAULT_PARAMS): Record<Rating, Date> {
  return {
    [Rating.Again]: review(card, Rating.Again, now, p).due,
    [Rating.Hard]: review(card, Rating.Hard, now, p).due,
    [Rating.Good]: review(card, Rating.Good, now, p).due,
    [Rating.Easy]: review(card, Rating.Easy, now, p).due,
  };
}

export interface QueueLimits { newPerDay: number; reviewsPerDay: number }

/** Today's study queue: due learning cards first, then due reviews (most forgotten first), then new cards. */
export function dueQueue(cards: Card[], now: Date, limits: QueueLimits = { newPerDay: 20, reviewsPerDay: 200 }): Card[] {
  const t = now.getTime();
  const learning = cards.filter((c) => (c.state === State.Learning || c.state === State.Relearning) && c.due.getTime() <= t);
  const reviews = cards
    .filter((c) => c.state === State.Review && c.due.getTime() <= t)
    .sort((a, b) => retrievability((t - (a.lastReview?.getTime() ?? t)) / DAY_MS, a.stability) - retrievability((t - (b.lastReview?.getTime() ?? t)) / DAY_MS, b.stability))
    .slice(0, limits.reviewsPerDay);
  const fresh = cards.filter((c) => c.state === State.New).slice(0, limits.newPerDay);
  return [...learning, ...reviews, ...fresh];
}

/** Leech: a card failed this many times needs rewriting, not more repetition (Anki default is 8). */
export const isLeech = (c: Card, threshold = 8) => c.lapses >= threshold;
