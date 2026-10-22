import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryTotal } from '@/lib/finance';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';

/** На що йдуть витрати: категорії з сумою, часткою й смужкою */
export function CategoryBreakdown({ items }: { items: CategoryTotal[] }) {
  const theme = useTheme();
  const total = items.reduce((s, i) => s + i.amount, 0);

  if (!total) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Витрат за цей період немає.
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.category} style={styles.item}>
          <View style={styles.row}>
            <ThemedText type="default">{item.category}</ThemedText>
            <ThemedText type="default" style={styles.bold}>
              {formatMoney(item.amount)}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.fill, { width: `${(item.amount / total) * 100}%`, backgroundColor: theme.accent }]} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.percent}>
              {Math.round((item.amount / total) * 100)}%
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  item: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  bold: { fontWeight: 700 },
  track: { flex: 1, height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill },
  percent: { width: 40, textAlign: 'right' },
});
