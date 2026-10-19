/**
 * Rank ladder: tiers with stars, mapped to a single points number.
 * Tier names and star counts follow the reference app; the point-to-tier mapping and the battle-result rules are
 * our own reading of its constants (the server is authoritative in the app), so treat the rules as a design.
 */
export const TIERS = ["Student II", "Student I", "Scholar III", "Scholar II", "Scholar I", "Topnotcher III", "Topnotcher II", "Topnotcher I", "Apex Topnotcher"] as const;
export const STARS = [3, 3, 3, 3, 3, 4, 4, 4, 0] as const;

/** Each tier starts one point after the previous tier's last star: start[i+1] = start[i] + stars[i] + 1. */
export const TIER_STARTS: number[] = STARS.reduce<number[]>((acc, stars, i) => (i === 0 ? [0] : [...acc, acc[i - 1] + STARS[i - 1] + 1]), []);
export const APEX_INDEX = TIERS.length - 1;
export const MAX_POINTS_BEFORE_APEX = TIER_STARTS[APEX_INDEX] - 1;

export function tierOf(points: number): number {
  const p = Math.max(0, points);
  let t = 0;
  for (let i = 0; i < TIER_STARTS.length; i++) if (p >= TIER_STARTS[i]) t = i;
  return t;
}
export const starsOf = (points: number) => Math.min(STARS[tierOf(points)], Math.max(0, points) - TIER_STARTS[tierOf(points)]);
export const tierName = (points: number) => TIERS[tierOf(points)];

export const RANK_CONFIG = { WIN_STARS: 1, LOSS_STARS: 1, STREAK_THRESHOLD: 3, STREAK_BONUS_STARS: 1, FLAWLESS_BONUS_STARS: 1, SEASON_LENGTH_DAYS: 90 } as const;

/** Design rule: a win adds stars (+ streak and flawless bonuses); a loss removes one star but never below 0 points. */
export function applyBattleResult(points: number, r: { won: boolean; winStreak: number; flawless: boolean }): number {
  if (!r.won) return Math.max(0, points - RANK_CONFIG.LOSS_STARS);
  let gain = RANK_CONFIG.WIN_STARS;
  if (r.winStreak >= RANK_CONFIG.STREAK_THRESHOLD) gain += RANK_CONFIG.STREAK_BONUS_STARS;
  if (r.flawless) gain += RANK_CONFIG.FLAWLESS_BONUS_STARS;
  return points + gain;
}

/** Combo multiplier in battles: 1 + 0.2 per extra correct answer in a row, capped (the app's cap was not recovered). */
export const comboMultiplier = (streak: number, cap = 2) => (streak <= 0 ? 1 : Math.min(cap, 1 + 0.2 * (streak - 1)));
