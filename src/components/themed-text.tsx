import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, MaxFontScale, ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'headline' | 'body' | 'callout' | 'caption' | 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // linkPrimary бере акцент із теми (у темній темі він світліший), а не хардкод
  const color = type === 'linkPrimary' && !themeColor ? theme.accent : theme[themeColor ?? 'text'];
  return <Text maxFontSizeMultiplier={MaxFontScale} style={[{ color, fontVariant: ['tabular-nums'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: Type.display,
  headline: Type.headline,
  body: Type.body,
  callout: Type.callout,
  caption: Type.caption,
  small: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  default: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  // Заголовок секції. Більший розмір заголовка екрана — `display`; 40 pt-вого заголовка в застосунку більше немає
  title: Type.title,
  subtitle: { fontSize: 30, lineHeight: 36, fontWeight: 700, letterSpacing: -0.6 },
  link: { lineHeight: 30, fontSize: 14 },
  linkPrimary: { lineHeight: 30, fontSize: 14 },
  code: { fontFamily: Fonts.mono, fontWeight: Platform.select({ android: 700 }) ?? 500, fontSize: 12 },
});
