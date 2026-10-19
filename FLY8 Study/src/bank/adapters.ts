/**
 * Adapters between BankItem v2 and the other question formats (MASTER_PLAN section 4.3).
 * Runtime imports are avoided on purpose (type-only imports) so scripts can load this file with plain node.
 */
import type { Area, BankItem, Bloom, Difficulty } from './schema';
import type { PnleItem } from '../pnle/types';
import type { Question } from '../core/types';

const AREA_SET = new Set(['NP1', 'NP2', 'NP3', 'NP4', 'NP5', 'GEN']);

function toArea(a: unknown): Area {
  const s = String(a ?? '').trim();
  if (AREA_SET.has(s)) return s as Area;
  return 'GEN'; // 'any' and anything unknown
}

function toDifficulty(n: unknown, fallback: Difficulty = 3): Difficulty {
  const v = Math.round(Number(n));
  return v >= 1 && v <= 5 ? (v as Difficulty) : fallback;
}

/** Small stable hash (FNV-1a, 8 hex chars) for user-item ids. */
export function hash8(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Gold PnleItem -> BankItem v2 (single). */
export function fromGold(g: PnleItem): BankItem {
  return {
    id: g.id,
    v: 2,
    type: 'single',
    area: toArea(g.area),
    topic: g.topic,
    vignette: g.vignette ?? '',
    stem: g.stem ?? '',
    options: [...g.options],
    answer: [g.answerIndex],
    rationale: g.reasoning,
    optionRationales: [...g.optionRationales],
    strategy: g.strategyTag,
    archetype: g.archetype,
    difficulty: toDifficulty(g.difficulty),
    keyFacts: [...(g.keyFacts ?? [])],
    source: 'gold',
    review: 'unreviewed',
    aiWritten: g.aiWritten !== false,
  };
}

/** App Question (kind 'choice' or absent) -> BankItem v2; other kinds are not imported (returns null). */
export function fromQuestion(q: Question, ctx: { area?: string; topic?: string; difficulty?: number } = {}): BankItem | null {
  if (q.kind && q.kind !== 'choice') return null;
  let stem = q.stem;
  const vignette = q.vignette ?? '';
  // The parser composes stem as `vignette + blank line + stem`; undo that so the two fields stay separate.
  if (vignette && stem.startsWith(vignette)) stem = stem.slice(vignette.length).replace(/^\s+/, '');
  const choices = [...q.choices];
  return {
    id: `u-${hash8(`${vignette}|${stem}|${choices.join('|')}`)}`,
    v: 2,
    type: 'single',
    area: toArea(q.area ?? ctx.area),
    topic: ctx.topic ?? q.topicId,
    topicId: q.topicId,
    vignette,
    stem,
    options: choices,
    answer: [q.answerIndex],
    rationale: q.reasoning ? `${q.rationale}\n${q.reasoning}` : q.rationale,
    optionRationales: q.optionRationales ? [...q.optionRationales] : choices.map(() => ''),
    strategy: q.strategy || 'unspecified',
    archetype: q.archetype,
    difficulty: toDifficulty(ctx.difficulty),
    source: 'user-ai',
    review: 'unreviewed',
    aiWritten: true,
  };
}

// ---------------------------------------------------------------- Content Authoring Kit JSON

/* eslint-disable @typescript-eslint/no-explicit-any */
type KitItem = any;

const KIT_DIFFICULTY: Record<string, Difficulty> = { easy: 2, moderate: 3, difficult: 4 };
const KIT_BLOOM: Record<string, Bloom> = {
  remembering: 'recall',
  understanding: 'recall',
  applying: 'apply',
  analyzing: 'judgment',
  evaluating: 'judgment',
  creating: 'judgment',
};

/** One kit item (mcq/sata/matrix/cloze/highlight) -> BankItem. Situation wrappers go through fromKit. */
export function fromKitItem(k: KitItem, shared: { vignette?: string; clusterId?: string; clusterSeq?: number } = {}): BankItem | null {
  if (!k || typeof k !== 'object') return null;
  const meta = k.meta ?? {};
  const base = {
    id: String(k.id),
    v: 2 as const,
    area: toArea(meta.nursing_practice),
    topic: String(meta.topic ?? ''),
    topicId: meta.topic_id ? String(meta.topic_id) : undefined,
    vignette: shared.vignette ?? '',
    stem: String(k.stem ?? ''),
    rationale: String(k.rationale ?? ''),
    strategy: String(meta.competency || meta.tos_content_area || 'unspecified'),
    difficulty: KIT_DIFFICULTY[String(meta.difficulty)] ?? 3,
    bloom: KIT_BLOOM[String(meta.cognitive_domain)],
    ...(shared.clusterId ? { clusterId: shared.clusterId, clusterSeq: shared.clusterSeq } : {}),
    source: 'bank' as const,
    review: 'unreviewed' as const,
    aiWritten: true,
    ...(meta.evidence_status === 'needs_review' ? { flags: ['check-textbook'] } : {}),
  };
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  switch (k.type) {
    case 'mcq': {
      const opts: any[] = Array.isArray(k.options) ? k.options : [];
      const answerIdx = letters.indexOf(String(k.answer));
      return {
        ...base,
        type: 'single',
        options: opts.map((o) => String(o.text)),
        answer: [answerIdx],
        optionRationales: opts.map((o, i) => (i === answerIdx ? base.rationale : String(o.why_not ?? ''))),
      };
    }
    case 'sata': {
      const opts: string[] = (k.options ?? []).map(String);
      return { ...base, type: 'sata', options: opts, answer: [...(k.answers ?? [])], optionRationales: opts.map(() => '') };
    }
    case 'matrix': {
      const rows: any[] = k.rows ?? [];
      return {
        ...base,
        type: 'matrix',
        options: [],
        answer: [],
        rows: rows.map((r) => String(r.text)),
        columns: (k.columns ?? []).map(String),
        rowAnswer: rows.map((r) => Number(r.correct_column)),
        optionRationales: [],
      };
    }
    case 'cloze': {
      const blanks: any[] = k.blanks ?? [];
      return {
        ...base,
        type: 'cloze',
        stem: `${base.stem}\n\n${String(k.text ?? '')}`.trim(),
        options: [],
        answer: [],
        blanks: blanks.map((b) => ({ choices: (b.choices ?? []).map(String), answer: Number(b.correct_index) })),
        optionRationales: [],
      };
    }
    case 'highlight': {
      const segs: any[] = (k.segments ?? []).filter((s: any) => s.selectable);
      const answer: number[] = [];
      segs.forEach((s, i) => {
        if (s.correct) answer.push(i);
      });
      return { ...base, type: 'highlight', options: segs.map((s) => String(s.text)), answer, optionRationales: [] };
    }
    default:
      return null;
  }
}

/** Kit file content (array of items and/or situation wrappers) -> BankItem[]. Unknown entries are skipped. */
export function fromKit(content: KitItem | KitItem[]): BankItem[] {
  const list = Array.isArray(content) ? content : [content];
  const out: BankItem[] = [];
  for (const entry of list) {
    if (entry?.type === 'situation') {
      const cid = String(entry.id);
      (entry.items ?? []).forEach((child: KitItem, i: number) => {
        const it = fromKitItem(child, { vignette: String(entry.situation ?? ''), clusterId: cid, clusterSeq: i + 1 });
        if (it) out.push(it);
      });
    } else {
      const it = fromKitItem(entry);
      if (it) out.push(it);
    }
  }
  return out;
}

// ---------------------------------------------------------------- back to the legacy quiz UI

/** BankItem -> app Question for the existing quiz UI. Only single items map; others return null. */
export function toLegacyQuestion(item: BankItem): Question | null {
  if (item.type !== 'single') return null;
  const stem = item.vignette ? `${item.vignette}\n\n${item.stem}` : item.stem;
  return {
    id: item.id,
    topicId: item.topicId ?? item.topic,
    stem,
    choices: [...item.options],
    answerIndex: item.answer[0],
    rationale: item.rationale,
    kind: 'choice',
    ...(item.vignette ? { vignette: item.vignette } : {}),
    strategy: item.strategy,
    area: item.area === 'GEN' ? 'any' : item.area,
    ...(item.archetype ? { archetype: item.archetype } : {}),
    optionRationales: [...item.optionRationales],
  };
}
