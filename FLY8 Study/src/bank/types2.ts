import type { Area } from './schema';
import type { SessionMode } from './session';

/** One answered item, as stored by the bank store (plain data so selectors stay pure). */
export interface AttemptRecord {
  itemId: string;
  /** 0..1 partial credit. */
  credit: number;
  seconds: number;
  /** Epoch ms. */
  at: number;
  sessionId?: string;
  mode?: SessionMode;
  area: Area;
  topic: string;
  strategy: string;
}

/** Every selector returns ids plus whether the pool was too small. */
export interface Selection {
  ids: string[];
  requested: number;
  short: boolean;
}

export type CustomFilter = 'unseen' | 'missed' | 'flagged';

export interface HistoryEntry {
  id: string;
  mode: SessionMode;
  /** Epoch ms the session was finished (or last touched if active). */
  at: number;
  status: 'active' | 'done';
  percent: number;
  total: number;
  answered: number;
  correct: number;
  seconds: number;
}
