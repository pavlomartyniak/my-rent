import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryShare } from '@/lib/reports';
import { categoryColor } from '@/lib/category-color';
import { formatMoney } from '@/lib/format';

import { DonutChart } from './donut-chart';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** На що йдуть витрати: кільцева діаграма із загальною сумою, а під нею категорії з кольором, сумою, смужкою й часткою */
export function CategoryBreakdown({ items, onSelect, emptyText = 'Витрат за цей період немає.', label }: { items: (CategoryShare & { count?: number })[]; /** Якщо задано, рядок категорії натискається (наприклад, показати її записи) */ onSelect?: (category: string) => void; emptyText?: string; /** Підпис під сумою в центрі кільця */ label?: string }) {
  const theme = useTheme();
  if (!items.length) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.positiveSoft }]}>
          <Icon name="checkmark" size={20} color="positive" />
        </View>
        <ThemedText type="default">{emptyText}</ThemedText>
      </View>
    );
  }

  const colored = items.map((item, i) => ({ ...item, color: categoryColor(item.category, i) }));

  return (
    <View style={styles.wrap}>
      <DonutChart slices={colored.map((c) => ({ key: c.category, amount: c.amount, color: c.color }))} label={label} />
      <View style={styles.list}>
        {colored.map((item) => (
          <Pressable
            key={item.category}
            disabled={!onSelect}
            onPress={() => onSelect?.(item.category)}
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityLabel={onSelect ? `${item.category}: ${formatMoney(item.amount)}, ${Math.round(item.share)}%. Показати записи` : undefined}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
            <View style={styles.row}>
              <View style={styles.name}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                  {item.category}
                </ThemedText>
                {item.count ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    · {item.count}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="default" style={styles.amount}>
                {formatMoney(item.amount)}
              </ThemedText>
            </View>
            <View style={styles.row}>
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View style={[styles.fill, { width: `${Math.max(item.share, 2)}%`, backgroundColor: item.color }]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.percent}>
                {Math.round(item.share)}%
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wrap: { gap: Spacing.four },
  list: { gap: Spacing.three },
  name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  amount: { fontWeight: 600, flexShrink: 0, textAlign: 'right' },
  flex: { flexShrink: 1 },
  item: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  bold: { fontWeight: 600 },
  track: { flex: 1, height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill },
  percent: { width: 40, textAlign: 'right' },
});
