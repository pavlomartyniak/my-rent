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
    ink: '#222222',
    onInk: '#FFFFFF',
    positive: '#0A7D3B',
    positiveSoft: '#E6F4EB',
    negative: '#C93B2B',
    negativeSoft: '#FCEBE8',
    warning: '#B35C00',
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
