/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#222222',
    background: '#FFFFFF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F2F2F2',
    textSecondary: '#6A6A6A',
    border: '#EBEBEB',
    borderStrong: '#C9C9C9',
    accent: '#3D39CC',
    accentSoft: '#ECEBFA',
    onAccent: '#FFFFFF',
    ink: '#222222',
    onInk: '#FFFFFF',
    positive: '#0A7D3B',
    positiveSoft: '#E6F4EB',
    negative: '#B83325',
    negativeSoft: '#FCEBE8',
    warning: '#9A4F00',
    warningSoft: '#FFF1DB',
  },
  dark: {
    text: '#F5F5F5',
    background: '#121212',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2A2A2C',
    textSecondary: '#A1A1A6',
    border: '#2C2C2E',
    borderStrong: '#48484A',
    accent: '#8E86FF',
    accentSoft: '#26234A',
    // Світлий акцент у темній темі: білий текст на ньому має контраст ~3:1, темний — понад 6:1 (WCAG AA)
    onAccent: '#14123A',
    ink: '#F5F5F5',
    onInk: '#121212',
    positive: '#3DD68C',
    positiveSoft: '#12332A',
    negative: '#FF7A6B',
    negativeSoft: '#3A1D1A',
    warning: '#F5A524',
    warningSoft: '#3A2D14',
  },
} as const;

export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** Типографічна шкала: 6 рівнів. Усе, що не вписується, — виняток, який треба обґрунтувати. */
export const Type = {
  /** Головна цифра екрана: прибуток, ціна, сума */
  hero: { fontSize: 40, lineHeight: 48, fontWeight: 700, letterSpacing: -0.8 },
  /** Велика цифра в картці: підсумок, баланс, відсоток */
  figure: { fontSize: 28, lineHeight: 34, fontWeight: 700, letterSpacing: -0.3 },
  display: { fontSize: 32, lineHeight: 38, fontWeight: 700, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700, letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
} as const;

/** Максимальне масштабування шрифту (Dynamic Type): далі за ним верстка ламається */
export const MaxFontScale = 1.3;

/** Мінімальна зона натискання: 44 pt (iOS) / 48 dp (Android) */
export const MinHit = Platform.select({ ios: 44, default: 48 });

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
