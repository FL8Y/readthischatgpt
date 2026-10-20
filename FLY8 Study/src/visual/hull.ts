export type Pt = [number, number];

/** Convex hull (Andrew's monotone chain). Returns 0-2 points for degenerate input. */
export function convexHull(points: Pt[]): Pt[] {
  const p = points.filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length <= 2) return p.slice();
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  const h = lower.concat(upper);
  return h.length < 3 ? [p[0], p[p.length - 1]] : h;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** SVG path for a hull; 1-2 point hulls become a (zero-length) line so round caps draw a dot/capsule. */
export function hullPath(hull: Pt[]): string {
  if (!hull.length) return '';
  if (hull.length === 1) return `M${f(hull[0][0])} ${f(hull[0][1])}L${f(hull[0][0] + 0.01)} ${f(hull[0][1])}`;
  if (hull.length === 2) return `M${f(hull[0][0])} ${f(hull[0][1])}L${f(hull[1][0])} ${f(hull[1][1])}`;
  return 'M' + hull.map((q) => `${f(q[0])} ${f(q[1])}`).join('L') + 'Z';
}
