// Pure data shaping for the Results, History and Stats screens and their hand-drawn charts.
import { dayKey } from './clock';
import { latestByItem } from './curate';
import { READINESS_FLOOR, OVERALL_LABEL, type OverallReadiness } from './readiness';
import { AREAS, type Area, type BankItem } from './schema';
import type { SessionMode } from './session';
import { addDays } from './streak';
import type { GridStatus } from './results';
import type { AttemptRecord } from './types2';

export interface AreaAcc { area: Area; percent: number; answered: number }

/** Accuracy by credit for each area that has answers, weakest first (ties: more answers first, then name). */
export function areaAccuracy(attempts: readonly AttemptRecord[]): AreaAcc[] {
  const out: AreaAcc[] = [];
  for (const area of AREAS) {
    const mine = attempts.filter((a) => a.area === area);
    if (!mine.length) continue;
    out.push({ area, answered: mine.length, percent: (mine.reduce((s, a) => s + a.credit, 0) / mine.length) * 100 });
  }
  return out.sort((a, b) => a.percent - b.percent || b.answered - a.answered || a.area.localeCompare(b.area));
}

export interface TrendPoint { day: string; label: string; percent: number | null; answered: number }

/** `span` Manila days ending `today` (oldest first). percent is null on days without answers. */
export function trendDays(attempts: readonly AttemptRecord[], today: string, span = 14): TrendPoint[] {
  const sums = new Map<string, { credit: number; n: number }>();
  for (const a of attempts) {
    const k = dayKey(a.at);
    const e = sums.get(k) ?? { credit: 0, n: 0 };
    e.credit += a.credit; e.n++;
    sums.set(k, e);
  }
  const out: TrendPoint[] = [];
  for (let k = span - 1; k >= 0; k--) {
    const day = addDays(today, -k);
    const e = sums.get(day);
    out.push({ day, label: day.slice(8), percent: e ? (e.credit / e.n) * 100 : null, answered: e?.n ?? 0 });
  }
  return out;
}

export interface Pt { x: number; y: number }

/** Plot trend points into pixel space. Returns separate line runs (broken at empty days) and every dot. */
export function trendGeometry(points: readonly TrendPoint[], width: number, height: number, pad = 8): { runs: Pt[][]; dots: (Pt & { day: string; percent: number })[] } {
  const n = points.length;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const runs: Pt[][] = [];
  const dots: (Pt & { day: string; percent: number })[] = [];
  let cur: Pt[] = [];
  points.forEach((p, i) => {
    if (p.percent === null) {
      if (cur.length) runs.push(cur);
      cur = [];
      return;
    }
    const pct = Math.min(100, Math.max(0, p.percent));
    const pt = { x: pad + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW), y: pad + (1 - pct / 100) * innerH };
    cur.push(pt);
    dots.push({ ...pt, day: p.day, percent: p.percent });
  });
  if (cur.length) runs.push(cur);
  return { runs, dots };
}

export const pathFor = (run: readonly Pt[]): string => run.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** Spoken summary of the trend for screen readers. */
export function trendSummary(points: readonly TrendPoint[]): string {
  const have = points.filter((p) => p.percent !== null);
  if (!have.length) return 'No answers in the last 14 days.';
  const first = Math.round(have[0].percent as number);
  const last = Math.round(have[have.length - 1].percent as number);
  return `${have.length} active days. First ${first} percent, latest ${last} percent.`;
}

export interface TopicStat {
  topic: string;
  area: Area;
  correct: number;
  wrong: number;
  unseen: number;
  total: number;
  /** Correct share of seen items (0..100), or null when nothing was seen. */
  percent: number | null;
}

/**
 * Per topic, from each item's latest attempt: full credit = Correct, anything less = Wrong
 * (partial credit counts as Wrong), no attempt = Unseen. Weakest first, then unseen-heavy topics.
 */
export function topicStats(attempts: readonly AttemptRecord[], items: readonly BankItem[]): TopicStat[] {
  const latest = latestByItem(attempts);
  const m = new Map<string, TopicStat>();
  for (const it of items) {
    const key = `${it.area}|${it.topic}`;
    const t = m.get(key) ?? { topic: it.topic, area: it.area, correct: 0, wrong: 0, unseen: 0, total: 0, percent: null };
    t.total++;
    const a = latest.get(it.id);
    if (!a) t.unseen++;
    else if (a.credit >= 1) t.correct++;
    else t.wrong++;
    m.set(key, t);
  }
  const list = [...m.values()];
  for (const t of list) {
    const seen = t.correct + t.wrong;
    t.percent = seen ? (t.correct / seen) * 100 : null;
  }
  return list.sort((a, b) => {
    const pa = a.percent === null ? 101 : a.percent;
    const pb = b.percent === null ? 101 : b.percent;
    return pa - pb || b.wrong - a.wrong || a.topic.localeCompare(b.topic);
  });
}

export const GRID_LOOK: Record<GridStatus, { glyph: string; word: string }> = {
  correct: { glyph: '✓', word: 'Correct' },
  partial: { glyph: '◐', word: 'Partial' },
  wrong: { glyph: '✗', word: 'Wrong' },
  skipped: { glyph: '–', word: 'Skipped' },
  flagged: { glyph: '⚑', word: 'Flagged' },
};

export const GRID_ORDER: readonly GridStatus[] = ['correct', 'partial', 'wrong', 'skipped', 'flagged'];

export function gridCounts(grid: readonly { status: GridStatus; outcome: Exclude<GridStatus, 'flagged'> }[]): Record<GridStatus, number> {
  const c: Record<GridStatus, number> = { correct: 0, partial: 0, wrong: 0, skipped: 0, flagged: 0 };
  for (const g of grid) {
    c[g.outcome]++;
    if (g.status === 'flagged') c.flagged++;
  }
  return c;
}

export const MODE_LABEL: Record<SessionMode, string> = {
  quick: 'Quick', custom: 'Custom', diagnostic: 'Diagnostic', mock: 'Mock board', adaptive: 'Adaptive',
  weak: 'Weak spots', requeue: 'Missed', smart: 'Smart set', case: 'Case study',
};

export const modeLabel = (m: SessionMode): string => MODE_LABEL[m] ?? m;

/** 'Oct 19, 2:05 PM' in Manila time. */
export function formatWhen(at: number): string {
  const d = new Date(at + 8 * 3600 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}

/** Text for the readiness chip. Locked: explains the 30-answer rule. */
export function readinessText(r: OverallReadiness | undefined): { locked: boolean; headline: string; detail: string } {
  if (!r || r.state === 'locked') {
    return {
      locked: true,
      headline: 'Readiness locked',
      detail: `Answer ${READINESS_FLOOR} questions in an NP area to unlock its estimate. ${OVERALL_LABEL}.`,
    };
  }
  const pct = Math.round(r.percent ?? 0);
  const note = r.noAreaBelow60 ? '' : ' An area is below 60%.';
  return { locked: false, headline: `${pct}% ${r.band}`, detail: `${OVERALL_LABEL}.${note}` };
}
