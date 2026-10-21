import React, { useEffect, useRef, useState } from 'react';
import { Modal, StatusBar, View } from 'react-native';
import { composeManualPrompt, ManualCancelled, setManualHandler, type ManualOptions } from '../ai/manual';
import type { ModelRequest } from '../ai/provider';
import { ManualExchange } from './ManualExchange';
import { c } from './kit';

type Job = {
  id: number;
  req: ModelRequest;
  opts: ManualOptions;
  resolve: (t: string) => void;
  reject: (e: Error) => void;
};

/**
 * Mount once in App.tsx. Registers the manual handler and shows one exchange at a time in a full-screen
 * Modal; concurrent AI calls wait in a queue. Renders nothing while idle.
 */
export function ManualHost() {
  const queue = useRef<Job[]>([]);
  const next = useRef(1);
  const [current, setCurrent] = useState<Job | null>(null);

  useEffect(() => {
    const advance = () => setCurrent(queue.current[0] ?? null);
    const finish = (job: Job) => {
      queue.current = queue.current.filter((j) => j !== job);
      advance();
    };
    setManualHandler(
      (req, opts = {}) =>
        new Promise<string>((resolve, reject) => {
          if (opts.signal?.aborted) return reject(new ManualCancelled());
          const job: Job = { id: next.current++, req, opts, resolve, reject };
          opts.signal?.addEventListener('abort', () => {
            if (!queue.current.includes(job)) return;
            finish(job);
            reject(new ManualCancelled());
          });
          queue.current.push(job);
          if (queue.current.length === 1) advance();
        }),
    );
    return () => {
      setManualHandler(null);
      for (const j of queue.current) j.reject(new ManualCancelled());
      queue.current = [];
    };
  }, []);

  const done = (job: Job, ok: boolean, text = '') => {
    queue.current = queue.current.filter((j) => j !== job);
    setCurrent(queue.current[0] ?? null);
    if (ok) job.resolve(text);
    else job.reject(new ManualCancelled());
  };

  return (
    <Modal visible={!!current} animationType="slide" onRequestClose={() => {
        if (current) done(current, false);
      }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 48 }}>
        {current ? (
          <ManualExchange
            key={current.id}
            title="Ask ChatGPT or Claude"
            purpose={
              (current.opts.purpose ?? 'AI request') + (queue.current.length > 1 ? ` (${queue.current.length - 1} more waiting)` : '')
            }
            prompt={composeManualPrompt(current.req, current.opts)}
            expect={current.opts.expect ?? 'text'}
            onReply={(t) => done(current, true, t)}
            onCancel={() => done(current, false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}
