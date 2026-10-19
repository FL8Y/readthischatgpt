import type { Frontmatter, ParsedNote, WikiLink } from './types';

const unquote = (s: string): string => {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1).replace(/\\(["'\\])/g, '$1');
  }
  return t;
};

function splitInlineList(v: string): string[] {
  // "[a, b]" or "a, b" or a single value
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '');
  return inner
    .split(',')
    .map((x) => unquote(x).replace(/^#/, ''))
    .filter(Boolean);
}

/** Splits leading YAML frontmatter from the body. Safe: plain string handling, no eval. */
export function splitFrontmatter(text: string): { fm: Frontmatter; body: string } {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n(?:---|\.\.\.)[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { fm: { aliases: [], tags: [] }, body: src };
  const fm: Frontmatter = { aliases: [], tags: [] };
  let listKey: 'aliases' | 'tags' | null = null;
  for (const line of m[1].split('\n')) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      const v = unquote(item[1]).replace(/^#/, '');
      if (v) fm[listKey].push(v);
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    listKey = null;
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const val = kv[2].trim();
    if (key === 'title') {
      const t = unquote(val);
      if (t) fm.title = t;
    } else if (key === 'aliases' || key === 'alias' || key === 'tags' || key === 'tag') {
      const bucket = key.startsWith('alias') ? 'aliases' : 'tags';
      if (val) fm[bucket].push(...splitInlineList(val));
      else listKey = bucket;
    }
  }
  fm.aliases = [...new Set(fm.aliases)];
  fm.tags = [...new Set(fm.tags)];
  return { fm, body: src.slice(m[0].length) };
}

/** Removes ![[embeds]] (images, transclusions). Plain [[wikilinks]] stay. */
export function stripEmbeds(text: string): string {
  return text.replace(/!\[\[[^\]\n]*\]\]/g, '');
}

/** Wikilinks with heading and alias kept. Ignores embeds. De-duplicated by target+heading. */
export function parseWikilinks(text: string): WikiLink[] {
  const out: WikiLink[] = [];
  const seen = new Set<string>();
  const re = /(!?)\[\[([^\]\n]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1]) continue;
    const [left, ...aliasParts] = m[2].split('|');
    const alias = aliasParts.join('|').trim() || undefined;
    const [target, ...headParts] = left.split('#');
    const t = target.trim();
    if (!t) continue;
    const heading = headParts.join('#').trim() || undefined;
    const key = `${t.toLowerCase()}#${heading ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ target: t, heading, alias });
  }
  return out;
}

export function isIgnoredPath(path: string): boolean {
  return path.split('/').some((seg) => seg === '.obsidian' || seg === '.trash' || seg === '.git');
}

export function baseName(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[^.]+$/, '');
}

/** Directory path becomes the folder; nested directories are flattened with " / ". */
export function folderFromPath(path: string, rootPrefix = ''): string {
  let p = path;
  if (rootPrefix && p.startsWith(rootPrefix)) p = p.slice(rootPrefix.length);
  return p.split('/').slice(0, -1).filter(Boolean).join(' / ');
}

/** Parses one Markdown note. Never throws: bad frontmatter just yields defaults. */
export function parseNote(path: string, text: string, rootPrefix = ''): ParsedNote {
  const { fm, body: raw } = splitFrontmatter(text);
  const body = stripEmbeds(raw).replace(/\n{3,}/g, '\n\n').trim();
  // Title: frontmatter title, else the file name. #tags in the body are intentionally ignored.
  const title = fm.title || baseName(path) || 'Untitled';
  return {
    path,
    title,
    aliases: fm.aliases,
    tags: fm.tags,
    body,
    links: parseWikilinks(body),
    folder: folderFromPath(path, rootPrefix),
  };
}
