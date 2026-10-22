/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1B3A',
    background: '#F3F7FF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4ECFF',
    textSecondary: '#5B6B8C',
    border: '#DCE6FA',
    borderStrong: '#B4C6EE',
    accent: '#1F5BFF',
    accentSoft: '#E6EEFF',
    positive: '#12A150',
    positiveSoft: '#E3F6EC',
    negative: '#E5484D',
    negativeSoft: '#FDECEC',
    warning: '#E8890C',
    warningSoft: '#FFF1DD',
  },
  dark: {
    text: '#EAF1FF',
    background: '#0A1226',
    backgroundElement: '#111C38',
    backgroundSelected: '#1B2B52',
    textSecondary: '#8DA2CC',
    border: '#1D2D54',
    borderStrong: '#3A4F85',
    accent: '#5B8CFF',
    accentSoft: '#172A55',
    positive: '#3DD68C',
    positiveSoft: '#11332B',
    negative: '#FF7A7F',
    negativeSoft: '#3A1A25',
    warning: '#F5A524',
    warningSoft: '#3A2D14',
  },
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

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
