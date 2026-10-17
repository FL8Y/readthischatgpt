/** Wikimedia Commons image search (public API, no key). Pure URL builder + parser; fetch is injectable. */
export interface CommonsImage {
  title: string;
  thumbUrl: string;
  author: string;
  license: string;
  /** Commons file page: where attribution links go. */
  pageUrl: string;
}

const API = 'https://commons.wikimedia.org/w/api.php';

export function commonsSearchUrl(query: string, limit = 4, thumbWidth = 640): string {
  const q = query.trim().slice(0, 120);
  const params = [
    'action=query',
    'format=json',
    'origin=*',
    'generator=search',
    `gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}`,
    'gsrnamespace=6',
    `gsrlimit=${Math.max(1, Math.min(10, Math.round(limit)))}`,
    'prop=imageinfo',
    'iiprop=url|extmetadata',
    `iiurlwidth=${Math.round(thumbWidth)}`,
  ];
  return `${API}?${params.join('&')}`;
}

const stripHtml = (s: unknown): string =>
  typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u);

/** Parses an API response; entries without an https thumbnail or file page are dropped. Never throws. */
export function parseCommons(json: unknown): CommonsImage[] {
  const pages = (json as any)?.query?.pages;
  if (!pages || typeof pages !== 'object') return [];
  const out: (CommonsImage & { index: number })[] = [];
  for (const p of Object.values(pages) as any[]) {
    const info = p?.imageinfo?.[0];
    const thumbUrl = info?.thumburl;
    const pageUrl = info?.descriptionurl;
    if (!isHttps(thumbUrl) || !isHttps(pageUrl)) continue;
    const meta = info.extmetadata ?? {};
    out.push({
      index: Number.isFinite(p.index) ? p.index : 999,
      title: stripHtml(p.title).replace(/^File:/i, '') || 'Untitled',
      thumbUrl,
      pageUrl,
      author: stripHtml(meta.Artist?.value) || 'Unknown author',
      license: stripHtml(meta.LicenseShortName?.value) || 'License not stated',
    });
  }
  return out.sort((a, b) => a.index - b.index).map(({ index: _i, ...rest }) => rest);
}

/** Searches Commons. Any failure (offline, bad status, bad JSON) yields [] so a lesson is never blocked. */
export async function searchCommons(query: string, doFetch: typeof fetch = fetch, limit = 4): Promise<CommonsImage[]> {
  if (!query.trim()) return [];
  try {
    const res = await doFetch(commonsSearchUrl(query, limit));
    if (!res.ok) return [];
    return parseCommons(await res.json());
  } catch {
    return [];
  }
}

export const attributionLine = (img: CommonsImage): string => `${img.title} by ${img.author}, ${img.license}, via Wikimedia Commons`;
