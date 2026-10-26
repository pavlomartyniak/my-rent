import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** Біла картка з тонкою рамкою й м'якою тінню (у темній темі без тіні) */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, !dark && styles.shadow, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, borderWidth: 1 },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
});
