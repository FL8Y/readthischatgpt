/**
 * Practice engine for a nursing exam-prep app. Written for this project, informed by features seen in
 * Tangerine Prep 1.9.0 (NCLEX-style item types scored in credits, adaptive practice, daily streak on a fixed
 * timezone clock, free-tier energy cap). The real app's formulas are server-side and were NOT visible, so
 * everything here is an independent design, not a copy.
 */

// ---------- Items and scoring (partial credit) ----------
export type Item =
  | { kind: "mcq"; id: string; options: string[]; answer: number }
  | { kind: "sata"; id: string; options: string[]; answers: number[] }                 // select all that apply
  | { kind: "matrix"; id: string; rows: string[]; cols: string[]; answers: number[] }   // one column per row
  | { kind: "cloze"; id: string; blanks: { options: string[]; answer: number }[] };     // dropdown per blank

export type Response =
  | { kind: "mcq"; choice: number | null }
  | { kind: "sata"; choices: number[] }
  | { kind: "matrix"; choices: (number | null)[] }
  | { kind: "cloze"; choices: (number | null)[] };

export interface Score { earned: number; possible: number }

/** SATA uses the +/- rule: each correct pick +1, each wrong pick -1, floor 0, out of the number of right answers. */
export function scoreItem(item: Item, r: Response): Score {
  if (item.kind !== r.kind) throw new Error("response kind does not match item kind");
  switch (item.kind) {
    case "mcq": return { earned: (r as { choice: number | null }).choice === item.answer ? 1 : 0, possible: 1 };
    case "sata": {
      const picks = new Set((r as { choices: number[] }).choices);
      const right = new Set(item.answers);
      let net = 0;
      for (const p of picks) net += right.has(p) ? 1 : -1;
      return { earned: Math.max(0, net), possible: right.size };
    }
    case "matrix": {
      const ch = (r as { choices: (number | null)[] }).choices;
      return { earned: item.answers.filter((a, i) => ch[i] === a).length, possible: item.rows.length };
    }
    case "cloze": {
      const ch = (r as { choices: (number | null)[] }).choices;
      return { earned: item.blanks.filter((b, i) => ch[i] === b.answer).length, possible: item.blanks.length };
    }
  }
}

export const percent = (s: Score) => (s.possible === 0 ? 0 : Math.round((1000 * s.earned) / s.possible) / 10);

// ---------- Adaptive selection (Rasch / 1-parameter IRT) ----------
export interface BankItem { id: string; difficulty: number; area: string } // difficulty in logits, 0 = average

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Probability of a correct answer for a learner with ability `theta` on an item of difficulty `b`. */
export const pCorrect = (theta: number, b: number) => sigmoid(theta - b);

/** One stochastic-gradient step on the learner's ability after an answer (correct = 1, wrong = 0). */
export function updateAbility(theta: number, b: number, correct: boolean, step = 0.4): number {
  const next = theta + step * ((correct ? 1 : 0) - pCorrect(theta, b));
  return Math.max(-4, Math.min(4, next));
}

/** Pick the unseen item that tells us the most: difficulty closest to ability, with a bonus for weak areas. */
export function pickNext(bank: BankItem[], seen: Set<string>, theta: number, weakAreas: Set<string> = new Set()): BankItem | null {
  let best: BankItem | null = null, bestScore = Infinity;
  for (const it of bank) {
    if (seen.has(it.id)) continue;
    const score = Math.abs(it.difficulty - theta) - (weakAreas.has(it.area) ? 0.5 : 0);
    if (score < bestScore) { bestScore = score; best = it; }
  }
  return best;
}

/** Rough readiness: chance of answering an average-difficulty (0 logit) item correctly. */
export const readiness = (theta: number) => Math.round(pCorrect(theta, 0) * 100);

// ---------- Streak on a fixed-timezone day clock ----------
/** Calendar day key in an IANA timezone, e.g. "Asia/Manila". The same instant can be a different day elsewhere. */
export function dayKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

const dayNumber = (key: string) => Math.floor(Date.parse(key + "T00:00:00Z") / 86_400_000);

export interface Streak { current: number; best: number; lastDay: string | null }

export function recordActivity(s: Streak, at: Date, timeZone: string): Streak {
  const today = dayKey(at, timeZone);
  if (s.lastDay === today) return s;
  const gap = s.lastDay === null ? Infinity : dayNumber(today) - dayNumber(s.lastDay);
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

/** Streak shown to the user: it has lapsed if a whole day was missed. */
export function activeStreak(s: Streak, now: Date, timeZone: string): number {
  if (s.lastDay === null) return 0;
  const gap = dayNumber(dayKey(now, timeZone)) - dayNumber(s.lastDay);
  return gap <= 1 ? s.current : 0;
}

// ---------- Free-tier "energy" (daily question allowance) ----------
export interface Energy { used: number; day: string }
export const FREE_DAILY_ENERGY = 20;

export function spendEnergy(e: Energy, at: Date, timeZone: string, premium: boolean, cost = 1): { energy: Energy; allowed: boolean } {
  const day = dayKey(at, timeZone);
  const cur = e.day === day ? e : { used: 0, day };
  if (premium) return { energy: cur, allowed: true };
  if (cur.used + cost > FREE_DAILY_ENERGY) return { energy: cur, allowed: false };
  return { energy: { used: cur.used + cost, day }, allowed: true };
}
