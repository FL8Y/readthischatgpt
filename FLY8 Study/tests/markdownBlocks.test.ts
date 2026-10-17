import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdownBlocks, spansText } from '../src/core/markdownBlocks';

describe('parseInline', () => {
  it('parses bold, italic, code and wikilinks', () => {
    const s = parseInline('a **b** *c* `d` [[Target]] [[T2|alias]] [[T3#sec]]');
    expect(s.filter((x) => x.t !== 'text').map((x) => x.t)).toEqual(['bold', 'italic', 'code', 'link', 'link', 'link']);
    expect(s.find((x) => x.t === 'link' && x.target === 'T2')).toMatchObject({ label: 'alias' });
    expect(s.find((x) => x.t === 'link' && x.label === 'T3#sec')).toMatchObject({ target: 'T3' });
  });
  it('leaves plain text and stray asterisks alone', () => {
    expect(spansText(parseInline('2 * 3 = 6'))).toBe('2 * 3 = 6');
  });
});

describe('parseMarkdownBlocks', () => {
  const md = [
    '# Top', '## Sec', '### Sub', '', 'Para one', 'continues.', '',
    '- a', '- b with [[Link]]', '', '1. one', '2. two', '',
    '> quoted', '> more', '', '```', 'code line', '```', '',
    '| H1 | H2 |', '|---|---|', '| x | **y** |', '', '---', '', 'End',
  ].join('\n');
  const blocks = parseMarkdownBlocks(md);
  it('produces the expected block sequence', () => {
    expect(blocks.map((b) => b.t)).toEqual(['heading', 'heading', 'heading', 'paragraph', 'bullets', 'numbered', 'quote', 'code', 'table', 'rule', 'paragraph']);
  });
  it('clamps heading levels to 2-4', () => {
    expect(blocks.slice(0, 3).map((b) => (b.t === 'heading' ? b.level : 0))).toEqual([2, 2, 3]);
  });
  it('joins wrapped paragraph and quote lines', () => {
    expect(blocks[3].t === 'paragraph' && spansText(blocks[3].spans)).toBe('Para one continues.');
    expect(blocks[6].t === 'quote' && spansText(blocks[6].spans)).toBe('quoted more');
  });
  it('parses tables and lists', () => {
    const t = blocks[8];
    expect(t.t === 'table' && t.header.map(spansText)).toEqual(['H1', 'H2']);
    expect(t.t === 'table' && t.rows).toHaveLength(1);
    const l = blocks[4];
    expect(l.t === 'bullets' && l.items).toHaveLength(2);
    expect(blocks[7]).toEqual({ t: 'code', text: 'code line' });
  });
  it('survives empty input and unclosed fences', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
    expect(parseMarkdownBlocks('```\nabc')).toEqual([{ t: 'code', text: 'abc' }]);
  });
});
