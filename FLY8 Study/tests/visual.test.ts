import { describe, expect, it } from 'vitest';
import { sanitizeSvg, serializeSvg, SVG_MAX_CHARS } from '../src/visual/svg';
import { attributionLine, commonsSearchUrl, parseCommons, searchCommons } from '../src/visual/commons';
import { classifyEdges, layoutGraph } from '../src/visual/layout';
import { buildGraph } from '../src/core/vault';
import type { Topic } from '../src/core/types';

const clean = (code: string) => {
  const r = sanitizeSvg(code);
  if (!r.ok) throw new Error(r.reason);
  return serializeSvg(r.root);
};

describe('sanitizeSvg', () => {
  it('keeps whitelisted shapes and text', () => {
    const out = clean('<svg viewBox="0 0 100 100"><rect x="1" y="2" width="30" height="20" fill="#ff0000"/><text x="5" y="9">Heart</text></svg>');
    expect(out).toContain('<rect x="1" y="2" width="30" height="20" fill="#ff0000"></rect>');
    expect(out).toContain('>Heart<');
  });

  it('removes script elements with their contents', () => {
    const out = clean('<svg><script>alert(1)</script><circle cx="5" cy="5" r="2"/></svg>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<circle');
  });

  it('strips event handlers, hrefs and style/url() values', () => {
    const out = clean(
      '<svg onload="evil()"><rect onclick="x()" href="http://evil.com" xlink:href="javascript:1" style="fill:url(http://e)" fill="url(#a)" stroke="red" width="3" height="3"/></svg>',
    );
    expect(out).not.toMatch(/onload|onclick|href|style|url\(|evil|javascript/i);
    expect(out).toContain('stroke="red"');
  });

  it('drops external/embedding elements and their subtrees', () => {
    const out = clean(
      '<svg><image href="https://evil.com/a.png"/><use href="#x"/><foreignObject><div>hi</div><circle r="1"/></foreignObject><a href="http://x"><rect width="1" height="1"/></a><g><line x1="0" y1="0" x2="5" y2="5"/></g></svg>',
    );
    expect(out).not.toMatch(/image|use|foreignObject|<a|<div|evil/);
    expect(out).toContain('<line');
  });

  it('rejects bad attribute values (path with script chars, external transforms)', () => {
    const out = clean('<svg><path d="M0 0 L5 5 <script>" transform="url(x)" fill="red"/><path d="M0 0L5 5Z"/></svg>');
    expect(out).toContain('d="M0 0L5 5Z"');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('transform');
  });

  it('strips markup and entities from text content', () => {
    const out = clean('<svg><text>a &lt;b&gt; <tspan>ok</tspan></text></svg>');
    expect(out).not.toMatch(/&|<b>/);
  });

  it('fails closed on empty, oversized, non-svg and too-complex input', () => {
    expect(sanitizeSvg('').ok).toBe(false);
    expect(sanitizeSvg('x'.repeat(SVG_MAX_CHARS + 1)).ok).toBe(false);
    expect(sanitizeSvg('<div>hi</div>').ok).toBe(false);
    expect(sanitizeSvg('<svg>' + '<rect/>'.repeat(400) + '</svg>').ok).toBe(false);
    expect(sanitizeSvg('<svg>' + '<g>'.repeat(30) + '</g>'.repeat(30) + '</svg>').ok).toBe(false);
  });

  it('survives malformed markup without throwing', () => {
    expect(() => sanitizeSvg('<svg><rect <<>> width=3 ><g></svg')).not.toThrow();
  });
});

describe('Wikimedia Commons', () => {
  const sample = {
    query: {
      pages: {
        '2': {
          title: 'File:Heart diagram.svg',
          index: 2,
          imageinfo: [{ thumburl: 'https://upload.wikimedia.org/t2.png', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Heart_diagram.svg', extmetadata: { Artist: { value: '<a href="x">Jane Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }],
        },
        '1': {
          title: 'File:Heart.jpg',
          index: 1,
          imageinfo: [{ thumburl: 'https://upload.wikimedia.org/t1.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Heart.jpg', extmetadata: {} }],
        },
        '3': { title: 'File:bad.jpg', index: 3, imageinfo: [{ thumburl: 'http://insecure/x.jpg', descriptionurl: 'https://c/x' }] },
        '4': { title: 'File:noinfo.jpg', index: 4 },
      },
    },
  };

  it('builds an encoded API url', () => {
    const u = commonsSearchUrl('heart & lung', 3);
    expect(u.startsWith('https://commons.wikimedia.org/w/api.php?')).toBe(true);
    expect(u).toContain('gsrsearch=heart%20%26%20lung%20filetype%3Abitmap');
    expect(u).toContain('gsrlimit=3');
    expect(u).toContain('origin=*');
  });

  it('parses, orders and attributes; drops entries without https thumbs', () => {
    const r = parseCommons(sample);
    expect(r.map((i) => i.title)).toEqual(['Heart.jpg', 'Heart diagram.svg']);
    expect(r[0].author).toBe('Unknown author');
    expect(r[0].license).toBe('License not stated');
    expect(r[1].author).toBe('Jane Doe');
    expect(r[1].license).toBe('CC BY-SA 4.0');
    expect(attributionLine(r[1])).toContain('Jane Doe');
  });

  it('parse never throws on junk', () => {
    for (const j of [null, 5, {}, { query: {} }, { query: { pages: [] } }]) expect(parseCommons(j)).toEqual([]);
  });

  it('searchCommons uses the injected fetch and degrades to [] offline or on errors', async () => {
    let calledWith = '';
    const ok = (async (u: string) => {
      calledWith = u;
      return { ok: true, json: async () => sample };
    }) as unknown as typeof fetch;
    expect((await searchCommons('heart', ok)).length).toBe(2);
    expect(calledWith).toContain('gsrsearch=heart');
    const offline = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await searchCommons('heart', offline)).toEqual([]);
    const bad = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await searchCommons('heart', bad)).toEqual([]);
    const junk = (async () => ({ ok: true, json: async () => { throw new Error('x'); } })) as unknown as typeof fetch;
    expect(await searchCommons('heart', junk)).toEqual([]);
    expect(await searchCommons('  ', ok)).toEqual([]);
  });
});

describe('layoutGraph', () => {
  const mk = (n: number): Topic[] =>
    Array.from({ length: n }, (_, i) => ({ id: `t${i}`, folderId: i % 2 ? 'b' : 'a', title: `T${i}`, body: i ? `[[T${i - 1}]] [[T0]]` : '[[T1]]', sourceIds: [] }));

  it('is deterministic', () => {
    const g = buildGraph(mk(12));
    expect(layoutGraph(g)).toEqual(layoutGraph(g));
  });

  it('never overlaps nodes and stays inside the canvas for 0..30 nodes', () => {
    for (let n = 0; n <= 30; n++) {
      const g = buildGraph(mk(n));
      const l = layoutGraph(g);
      expect(l.nodes.length).toBe(n);
      for (const a of l.nodes) {
        expect(a.x - l.nodeRadius).toBeGreaterThanOrEqual(0);
        expect(a.y - l.nodeRadius).toBeGreaterThanOrEqual(0);
        expect(a.x + l.nodeRadius).toBeLessThanOrEqual(l.width);
        expect(a.y + l.nodeRadius).toBeLessThanOrEqual(l.height);
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const d = Math.hypot(l.nodes[i].x - l.nodes[j].x, l.nodes[i].y - l.nodes[j].y);
          expect(d, `n=${n} ${i}/${j}`).toBeGreaterThanOrEqual(2 * l.nodeRadius);
        }
    }
  });

  it('puts the most connected topic in the centre', () => {
    const l = layoutGraph(buildGraph(mk(8)));
    const centre = l.nodes.find((p) => p.x === l.width / 2 && p.y === l.height / 2);
    expect(centre?.id).toBe('t0');
  });

  it('classifies edges: mutual collapsed, cross-folder, plain link', () => {
    const topics = mk(3);
    const e = classifyEdges(buildGraph(topics), topics);
    const kind = (a: string, b: string) => e.find((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a))?.kind;
    expect(kind('t0', 't1')).toBe('mutual');
    expect(kind('t2', 't0')).toBe('link');
    expect(kind('t2', 't1')).toBe('cross-folder');
    expect(e.length).toBe(3);
  });
});
