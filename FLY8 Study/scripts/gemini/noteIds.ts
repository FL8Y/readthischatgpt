import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ids of every review note in data/presets (np*, gen*), for checking a question's noteId. */
export function PACK_NOTE_IDS(): Set<string> {
  const dir = join(__dirname, '..', '..', 'data', 'presets');
  const ids = new Set<string>();
  for (const f of readdirSync(dir).filter((n) => /^(np|gen)[^/]*\.json$/.test(n))) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { id?: string }[];
    if (Array.isArray(d)) for (const n of d) if (n && typeof n.id === 'string') ids.add(n.id);
  }
  return ids;
}
