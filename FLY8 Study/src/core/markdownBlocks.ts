/** Tiny Markdown parser for the note reader. Pure; handles the subset our notes use. */
export type Span =
  | { t: 'text'; text: string }
  | { t: 'bold'; text: string }
  | { t: 'italic'; text: string }
  | { t: 'code'; text: string }
  | { t: 'link'; target: string; label: string };

export type Block =
  | { t: 'heading'; level: 2 | 3 | 4; spans: Span[] }
  | { t: 'paragraph'; spans: Span[] }
  | { t: 'bullets'; items: Span[][] }
  | { t: 'numbered'; items: Span[][] }
  | { t: 'quote'; spans: Span[] }
  | { t: 'code'; text: string }
  | { t: 'table'; header: Span[][]; rows: Span[][][] }
  | { t: 'rule' };

const INLINE =
  /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*)\*|(?<![A-Za-z0-9])_([^_\s][^_]*)_(?![A-Za-z0-9])/g;

export function parseInline(text: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      const target = m[1].replace(/#.*$/, '').trim();
      out.push({ t: 'link', target, label: (m[2] ?? m[1]).trim() || target });
    } else if (m[3] !== undefined || m[4] !== undefined) out.push({ t: 'bold', text: m[3] ?? m[4] });
    else if (m[5] !== undefined) out.push({ t: 'code', text: m[5] });
    else out.push({ t: 'italic', text: m[6] ?? m[7] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) });
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((x) => x.trim());
const isSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const isRow = (line: string) => line.includes('|');
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUM = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdownBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence (or end of input)
      blocks.push({ t: 'code', text: buf.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = Math.min(4, Math.max(2, h[1].length)) as 2 | 3 | 4;
      blocks.push({ t: 'heading', level, spans: parseInline(h[2]) });
      i++;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ t: 'rule' });
      i++;
      continue;
    }
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = splitRow(line).map(parseInline);
      i += 2;
      const rows: Span[][][] = [];
      while (i < lines.length && lines[i].trim() && isRow(lines[i])) rows.push(splitRow(lines[i++]).map(parseInline));
      blocks.push({ t: 'table', header, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ t: 'quote', spans: parseInline(buf.join(' ').trim()) });
      continue;
    }
    if (BULLET.test(line) || NUM.test(line)) {
      const re = BULLET.test(line) ? BULLET : NUM;
      const items: Span[][] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) items.push(parseInline(m[1]));
        else if (/^\s{2,}\S/.test(lines[i]) && items.length && !BULLET.test(lines[i]) && !NUM.test(lines[i])) {
          items[items.length - 1] = [...items[items.length - 1], { t: 'text', text: ' ' }, ...parseInline(lines[i].trim())];
        } else break;
        i++;
      }
      blocks.push({ t: re === BULLET ? 'bullets' : 'numbered', items });
      continue;
    }
    const buf: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*```|\s*>)/.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUM.test(lines[i]) &&
      !RULE.test(lines[i])
    ) {
      buf.push(lines[i++].trim());
    }
    blocks.push({ t: 'paragraph', spans: parseInline(buf.join(' ')) });
  }
  return blocks;
}

/** Plain text of spans (for search and tests). */
export function spansText(spans: Span[]): string {
  return spans.map((s) => (s.t === 'link' ? s.label : s.text)).join('');
}
