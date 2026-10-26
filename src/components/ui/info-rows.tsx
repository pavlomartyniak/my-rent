import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';

/** Рядок «підпис — значення»: сірий підпис ліворуч, значення праворуч; `strong` — підсумковий рядок */
export function InfoRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'positive' | 'negative' }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type={strong ? 'default' : 'small'} style={[styles.value, strong && styles.strong]} themeColor={tone} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Список InfoRow із тонкими лініями між рядками */
export function InfoRows({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
  label: { flexShrink: 0 },
  value: { flex: 1, fontWeight: 600, textAlign: 'right' },
  strong: { fontWeight: 700 },
  divider: { height: StyleSheet.hairlineWidth },
});
