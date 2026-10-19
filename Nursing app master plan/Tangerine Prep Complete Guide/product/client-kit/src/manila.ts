/** Fixed UTC+8 day clock (no daylight saving) for streaks and daily goals. */
export const MANILA_OFFSET_MS = 8 * 3600_000;
const DAY = 86_400_000;
export const manilaDay = (at: number) => new Date(at + MANILA_OFFSET_MS).toISOString().slice(0, 10);
export const msUntilNextManilaDay = (now: number) => DAY - ((now + MANILA_OFFSET_MS) % DAY);
export function daysUntil(isoDate: string, now: number): number {
  const target = Date.parse(isoDate.length === 10 ? isoDate + "T00:00:00Z" : isoDate);
  return Math.ceil((target - (Math.floor((now + MANILA_OFFSET_MS) / DAY) * DAY)) / DAY);
}
