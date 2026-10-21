import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Appearance, useColorScheme, type TextStyle } from 'react-native';
import { dark, light, textStyle, type Palette, type TypeRole, type Weight } from './tokens';

export * from './tokens';

// ---- runtime ----

export interface Theme {
  scheme: 'light' | 'dark';
  colors: Palette;
  fontsLoaded: boolean;
  reduceMotion: boolean;
  /** Text style for a type role in the current font state. */
  type: (role: TypeRole, weight?: Weight) => TextStyle;
}

const buildTheme = (scheme: 'light' | 'dark', fontsLoaded: boolean, reduceMotion: boolean): Theme => ({
  scheme,
  colors: scheme === 'dark' ? dark : light,
  fontsLoaded,
  reduceMotion,
  type: (role, weight) => textStyle(role, fontsLoaded, weight),
});

const Ctx = createContext<{ fontsLoaded: boolean; reduceMotion: boolean }>({ fontsLoaded: false, reduceMotion: false });

export const currentScheme = (): 'light' | 'dark' => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

export function useReducedMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setOn(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

/** Wrap the app once. `fontsLoaded` flips to true when Inter is ready. */
export function ThemeProvider({ fontsLoaded, children }: { fontsLoaded: boolean; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const value = useMemo(() => ({ fontsLoaded, reduceMotion }), [fontsLoaded, reduceMotion]);
  return createElement(Ctx.Provider, { value }, children);
}

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { fontsLoaded, reduceMotion } = useContext(Ctx);
  return useMemo(() => buildTheme(scheme, fontsLoaded, reduceMotion), [scheme, fontsLoaded, reduceMotion]);
}
