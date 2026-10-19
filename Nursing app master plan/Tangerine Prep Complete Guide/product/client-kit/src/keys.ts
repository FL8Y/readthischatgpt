/** Idempotency keys. Random keys make a request unique; stable keys make a replay of the same request dedupe. */
export function newKey(prefix: string, uuid: () => string = () => crypto.randomUUID()): string {
  return `${prefix}:${uuid()}`;
}

/** 32-bit string hash with a seed (FNV-1a style). */
export function hash32(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return h >>> 0;
}

const SEEDS = [2166136261, 2654435769, 2246822507, 3266489909];
const US = "\u001f"; // unit separator: keeps ("ab","c") different from ("a","bc")

/** Same inputs always give the same key (128 bits from four seeded hashes). */
export function stableKey(prefix: string, ...parts: (string | number)[]): string {
  const s = parts.join(US);
  return `${prefix}:` + SEEDS.map((seed) => hash32(s, seed).toString(16).padStart(8, "0")).join("");
}
