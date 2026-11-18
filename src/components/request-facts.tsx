import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon, type IconName } from './ui/icon';

type Fact = { icon: IconName; label: string; value: string; /** Плитка на весь рядок (довге значення, наприклад дати) */ wide?: boolean };

/** Ключові умови запиту плитками: іконка, підпис і значення. Читається швидше за таблицю з розділювачами. */
export function FactTiles({ items }: { items: Fact[] }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((f) => (
        <View key={f.label} style={[styles.tile, { backgroundColor: theme.backgroundSelected }, f.wide ? styles.wide : styles.half]} accessible accessibilityLabel={`${f.label}: ${f.value}`}>
          <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
            <Icon name={f.icon} size={18} color="accent" />
          </View>
          <View style={styles.text}>
            <ThemedText type="caption" themeColor="textSecondary">
              {f.label}
            </ThemedText>
            <ThemedText type="callout" style={styles.value} numberOfLines={2}>
              {f.value}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Підсумок: розрахунок ліворуч (доби × ціна), сума праворуч великим шрифтом на акцентному фоні */
export function TotalBar({ calc, total, note }: { calc: string; total: string; note?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.total, { backgroundColor: theme.accentSoft }]} accessible accessibilityLabel={`${calc}. Разом ${total}`}>
      <View style={styles.text}>
        <ThemedText type="callout" themeColor="textSecondary">
          {calc}
        </ThemedText>
        {note ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText style={[styles.totalValue, { color: theme.accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.md, padding: Spacing.two + 4 },
  half: { flexGrow: 1, flexBasis: '47%' },
  wide: { width: '100%' },
  icon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  value: { fontWeight: 600 },
  total: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.md, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  totalValue: { ...Type.title, flexShrink: 1 },
});
