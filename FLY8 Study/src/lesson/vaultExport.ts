import type { AppState } from '../core/types';
import { toObsidianNote } from '../core/vault';

export interface VaultFile {
  path: string;
  content: string;
}

/** Filesystem-safe name: strips path separators/reserved chars, never empty. */
export function safeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'Untitled';
}

/** One .md per topic at "<folder>/<title>.md"; duplicate names get " (2)". Reads no settings, so no API key. */
export function exportVault(state: AppState): VaultFile[] {
  const used = new Set<string>();
  const out: VaultFile[] = [];
  for (const topic of state.topics) {
    const folder = state.folders.find((f) => f.id === topic.folderId)?.name ?? 'Unfiled';
    const sources = topic.sourceIds
      .map((id) => state.sources.find((s) => s.id === id)?.title)
      .filter((x): x is string => !!x);
    const dir = safeFilename(folder);
    const base = safeFilename(topic.title);
    let path = `${dir}/${base}.md`;
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `${dir}/${base} (${n}).md`;
    used.add(path.toLowerCase());
    out.push({ path, content: toObsidianNote(topic, folder, sources) });
  }
  return out;
}

/** Single shareable text: each file under a "=== path ===" header. */
export function vaultAsText(files: VaultFile[]): string {
  return files.map((f) => `=== ${f.path} ===\n${f.content}`).join('\n');
}
