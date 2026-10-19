import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BANK, setUserItems, type Bank } from '../../bank/loader';
import type { BankItem } from '../../bank/schema';
import { dayKey } from '../../bank/clock';
import {
  asyncStorageKV, BankPersistence, BankStore, emptyBankState, type BankAction, type BankState,
} from '../../bank/store';
import type { AttemptRecord, HistoryEntry } from '../../bank/types2';
import { registerBankStore } from '../../backupIO';
import { historyFromState, toAttemptRecords } from './practiceFlow';

export interface BankContextValue {
  /** False until the saved state has loaded. */
  ready: boolean;
  state: BankState;
  /** Bundled items plus the learner's own saved items. */
  bank: Bank;
  items: BankItem[];
  byId: Map<string, BankItem>;
  /** Today's Manila day key. */
  today: string;
  /** Store attempts in the shape the selectors and stats use. */
  attempts: AttemptRecord[];
  /** One entry per practice session, newest first. */
  history: HistoryEntry[];
  dispatch: (a: BankAction) => Promise<BankState>;
}

const Ctx = createContext<BankContextValue | null>(null);

/** In-memory fallback used only if device storage cannot be opened. */
const memoryPersistence = {
  load: async () => emptyBankState(),
  saveDiff: async () => undefined,
} as unknown as BankPersistence;

/** Creates the bank store once, loads it, and shares state with every screen below. */
export function BankProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<BankStore | null>(null);
  const [state, setState] = useState<BankState>(emptyBankState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      let persistence: BankPersistence;
      try {
        persistence = new BankPersistence(await asyncStorageKV());
      } catch {
        persistence = memoryPersistence;
      }
      const store = new BankStore(persistence);
      storeRef.current = store;
      registerBankStore(store);
      store.subscribe((s) => { if (live) setState(s); });
      try {
        const s = await store.init();
        if (live) setState(s);
      } catch {
        // keep the empty state; practice still works this session
      }
      if (live) setReady(true);
    })();
    return () => {
      live = false;
      registerBankStore(null);
    };
  }, []);

  const hadUser = useRef(false);
  const bank = useMemo(() => {
    if (state.userItems.length === 0 && !hadUser.current) return BANK;
    hadUser.current = true;
    return setUserItems(state.userItems);
  }, [state.userItems]);
  const today = dayKey(Date.now());
  const attempts = useMemo(() => toAttemptRecords(state.attempts, bank.byId), [state.attempts, bank]);
  const history = useMemo(() => historyFromState(state, bank.items), [state, bank]);

  const value = useMemo<BankContextValue>(() => ({
    ready, state, bank, items: bank.items, byId: bank.byId, today, attempts, history,
    dispatch: async (a) => (storeRef.current ? storeRef.current.dispatch(a) : state),
  }), [ready, state, bank, today, attempts, history]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the practice bank anywhere below BankProvider (Stats, Dashboard and History read this). */
export function useBank(): BankContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useBank must be used inside BankProvider');
  return v;
}
