/**
 * Safe handling of AI-drawn SVG. The model's markup is never rendered as-is: it is parsed into a
 * small tree that keeps only whitelisted elements/attributes, then drawn with react-native-svg.
 * Anything else (scripts, event handlers, links, images, styles, url() refs) is dropped.
 */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  /** Text content, only for text/tspan. */
  text?: string;
}

export type SvgResult = { ok: true; root: SvgNode; viewBox: string } | { ok: false; reason: string };

export const SVG_MAX_CHARS = 20_000;
const MAX_NODES = 300;
const MAX_DEPTH = 10;
const MAX_TEXT = 120;

const TAGS = new Set(['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan']);

const NUM = /^-?\d*\.?\d+(e-?\d+)?(%|px)?$/i;
const COLOR = /^(none|currentColor|#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\))$/i;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,eE+-]+$/;
const POINTS = /^[0-9\s.,eE+-]+$/;
const TRANSFORM = /^(\s*(translate|scale|rotate|matrix|skewX|skewY)\([0-9\s.,eE+-]*\)\s*)+$/;
const VIEWBOX = /^-?[\d.]+[\s,]+-?[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+$/;

const num = (v: string) => NUM.test(v);
const ATTRS: Record<string, (v: string) => boolean> = {
  x: num, y: num, cx: num, cy: num, r: num, rx: num, ry: num,
  x1: num, y1: num, x2: num, y2: num, width: num, height: num,
  'stroke-width': num, opacity: num, 'fill-opacity': num, 'stroke-opacity': num, 'font-size': num,
  fill: (v) => COLOR.test(v),
  stroke: (v) => COLOR.test(v),
  d: (v) => PATH_D.test(v),
  points: (v) => POINTS.test(v),
  transform: (v) => TRANSFORM.test(v),
  viewBox: (v) => VIEWBOX.test(v),
  'stroke-dasharray': (v) => POINTS.test(v),
  'stroke-linecap': (v) => /^(butt|round|square)$/.test(v),
  'stroke-linejoin': (v) => /^(miter|round|bevel)$/.test(v),
  'text-anchor': (v) => /^(start|middle|end)$/.test(v),
  'font-weight': (v) => /^(normal|bold|[1-9]00)$/.test(v),
};

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    const value = (m[2] ?? m[3] ?? '').trim();
    const ok = Object.prototype.hasOwnProperty.call(ATTRS, name) && ATTRS[name](value);
    if (ok) out[name] = value;
  }
  return out;
}

const cleanText = (s: string) => s.replace(/[<>&]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

/** Parses and sanitizes AI SVG. Fails closed: on any doubt the caller shows the caption instead. */
export function sanitizeSvg(code: string): SvgResult {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, reason: 'empty' };
  if (code.length > SVG_MAX_CHARS) return { ok: false, reason: 'too large' };
  const src = code
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const tokenRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>|([^<]+)/g;
  let root: SvgNode | undefined;
  const stack: SvgNode[] = [];
  /** > 0 while inside a dropped (disallowed) element: its whole subtree is skipped. */
  let skipDepth = 0;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(src))) {
    const [, closing, rawTag, attrSrc, selfClose, text] = m;
    if (text !== undefined) {
      const top = stack[stack.length - 1];
      if (!skipDepth && top && (top.tag === 'text' || top.tag === 'tspan')) {
        const t = cleanText(text);
        if (t) top.text = ((top.text ?? '') + ' ' + t).trim().slice(0, MAX_TEXT);
      }
      continue;
    }
    const tag = rawTag.toLowerCase() === 'svg' ? 'svg' : rawTag;
    if (closing) {
      if (skipDepth) skipDepth--;
      else stack.pop();
      continue;
    }
    if (skipDepth) {
      if (!selfClose) skipDepth++;
      continue;
    }
    if (!TAGS.has(tag) || (!root && tag !== 'svg') || (root && stack.length === 0)) {
      if (!selfClose) skipDepth++;
      continue;
    }
    if (++count > MAX_NODES || stack.length >= MAX_DEPTH) return { ok: false, reason: 'too complex' };
    const node: SvgNode = { tag, attrs: parseAttrs(attrSrc), children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node);
    else root = node;
    if (!selfClose) stack.push(node);
  }
  if (!root) return { ok: false, reason: 'no svg element' };
  const viewBox = root.attrs.viewBox ?? '0 0 100 100';
  return { ok: true, root, viewBox };
}

/** Serializes a sanitized tree back to markup (used by tests and debugging; the app draws the tree). */
export function serializeSvg(node: SvgNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  const inner = (node.text ?? '') + node.children.map(serializeSvg).join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}
