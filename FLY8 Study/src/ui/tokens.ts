import type { TextStyle } from 'react-native';

/**
 * Design tokens for FLY8 Study. One accent (indigo), calm neutrals, a semantic set.
 * Accent choice: indigo reads as "focus and study" without the medical-red or finance-green
 * associations; it stays distinct from the success green and danger red used for answers.
 * Every text/background pair used by the UI is checked in tests/theme.test.ts.
 */
export interface Palette {
  bg: string; // app background
  surface: string; // cards, sheets
  surfaceAlt: string; // inputs, tiles, tracks
  border: string; // hairlines
  text: string;
  textDim: string;
  accent: string; // fills (buttons, progress)
  onAccent: string; // text on accent fills
  accentText: string; // accent used as text/icon on bg or surface
  accentSoft: string; // tinted backgrounds
  success: string; // text/icon colour for success
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  scrim: string;
}

export const light: Palette = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F6',
  border: '#E2E5EE',
  text: '#13151F',
  textDim: '#586078',
  accent: '#4F46E5',
  onAccent: '#FFFFFF',
  accentText: '#4338CA',
  accentSoft: '#ECEDFF',
  success: '#116D33',
  successSoft: '#E6F6EC',
  warning: '#A8530A',
  warningSoft: '#FEF1DE',
  danger: '#BE1E2D',
  dangerSoft: '#FDEAEC',
  scrim: 'rgba(15,17,28,0.45)',
};

export const dark: Palette = {
  bg: '#0D0E14',
  surface: '#161823',
  surfaceAlt: '#1F2230',
  border: '#2A2E3E',
  text: '#F1F2F8',
  textDim: '#A3A9BE',
  accent: '#5F5CF0',
  onAccent: '#FFFFFF',
  accentText: '#A5A8FF',
  accentSoft: '#23254A',
  success: '#4ADE80',
  successSoft: '#10281B',
  warning: '#FBBF24',
  warningSoft: '#2D2310',
  danger: '#FF8A94',
  dangerSoft: '#321418',
  scrim: 'rgba(0,0,0,0.6)',
};

/** 8-pt spacing scale (with a 4 half-step). */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const TOUCH_MIN = 48;

export type TypeRole = 'display' | 'title' | 'headline' | 'body' | 'bodyStrong' | 'caption' | 'label';
export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** Type scale: size / line height (>= 1.4x for body) / weight. No all-caps. */
export const typeScale: Record<TypeRole, { size: number; line: number; weight: Weight; track?: number }> = {
  display: { size: 32, line: 40, weight: 'bold', track: -0.5 },
  title: { size: 24, line: 32, weight: 'bold', track: -0.3 },
  headline: { size: 18, line: 26, weight: 'semibold' },
  body: { size: 16, line: 24, weight: 'regular' },
  bodyStrong: { size: 16, line: 24, weight: 'semibold' },
  label: { size: 14, line: 20, weight: 'medium' },
  caption: { size: 13, line: 18, weight: 'regular' },
};

export const INTER: Record<Weight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
const SYSTEM_WEIGHT: Record<Weight, TextStyle['fontWeight']> = { regular: '400', medium: '500', semibold: '600', bold: '700' };

/** Text style for a role. Uses Inter once loaded; until then the system font with the same weight. */
export function textStyle(role: TypeRole, fontsLoaded: boolean, weight?: Weight): TextStyle {
  const t = typeScale[role];
  const w = weight ?? t.weight;
  return {
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.track,
    ...(fontsLoaded ? { fontFamily: INTER[w] } : { fontWeight: SYSTEM_WEIGHT[w] }),
  };
}

export const shadow = (scheme: 'light' | 'dark') =>
  scheme === 'light'
    ? { shadowColor: '#1B1F3B', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }
    : { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 0 };

// ---- contrast helpers (pure; used by tests and the check script) ----

const hex = (h: string): [number, number, number] => {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as [number, number, number];
};
/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(h: string): number {
  const [r, g, b] = hex(h).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #rrggbb colours (1..21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

