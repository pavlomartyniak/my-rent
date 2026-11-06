import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryShare } from '@/lib/reports';
import { categoryColor } from '@/lib/category-color';
import { formatMoney } from '@/lib/format';

import { DonutChart } from './donut-chart';
import { ThemedText } from './themed-text';

/** На що йдуть витрати: кільцева діаграма із загальною сумою, а під нею категорії з кольором, сумою, смужкою й часткою */
export function CategoryBreakdown({ items }: { items: CategoryShare[] }) {
  const theme = useTheme();
  if (!items.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Витрат за цей період немає.
      </ThemedText>
    );
  }

  const colored = items.map((item, i) => ({ ...item, color: categoryColor(item.category, i) }));

  return (
    <View style={styles.wrap}>
      <DonutChart slices={colored.map((c) => ({ key: c.category, amount: c.amount, color: c.color }))} />
      <View style={styles.list}>
        {colored.map((item) => (
          <View key={item.category} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.name}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <ThemedText type="default" style={styles.bold}>
                  {item.category}
                </ThemedText>
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
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.four },
  list: { gap: Spacing.three },
  name: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  amount: { fontWeight: 600 },
  item: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  bold: { fontWeight: 700 },
  track: { flex: 1, height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill },
  percent: { width: 40, textAlign: 'right' },
});
