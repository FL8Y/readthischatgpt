import { describe, expect, it } from 'vitest';
import { contrast, dark, light, luminance, radius, space, textStyle, typeScale, type Palette } from '../src/ui/tokens';

describe('contrast helper', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

/** [foreground, background, minimum ratio]. 4.5 for body text, 3 for large text / icons. */
const pairs: [keyof Palette, keyof Palette, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceAlt', 4.5],
  ['textDim', 'bg', 4.5],
  ['textDim', 'surface', 4.5],
  ['textDim', 'surfaceAlt', 4.5],
  ['onAccent', 'accent', 4.5],
  ['accentText', 'bg', 4.5],
  ['accentText', 'surface', 4.5],
  ['accentText', 'accentSoft', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'successSoft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warningSoft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'dangerSoft', 4.5],
  ['accent', 'bg', 3],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s palette contrast', (_n, p) => {
  it.each(pairs)('%s on %s is at least %d:1', (fg, bg, min) => {
    expect(contrast(p[fg] as string, p[bg] as string)).toBeGreaterThanOrEqual(min);
  });
});

describe('scales', () => {
  it('spacing follows the 8-pt grid (4 half-step)', () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
    expect(radius.lg).toBe(16);
    expect(radius.xl).toBe(24);
  });
  it('body line height is at least 1.4x', () => {
    expect(typeScale.body.line / typeScale.body.size).toBeGreaterThanOrEqual(1.4);
  });
  it('falls back to system weights before Inter loads', () => {
    expect(textStyle('title', false).fontFamily).toBeUndefined();
    expect(textStyle('title', true).fontFamily).toBe('Inter_700Bold');
  });
});
