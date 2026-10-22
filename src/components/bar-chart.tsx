import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthLabel } from '@/lib/date';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';

type Point = { month: string; income: number; expense: number };

const CHART_HEIGHT = 120;

const barHeight = (value: number, max: number) => (value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 0);

/** Прості стовпчики: зелений — доходи, червоний — витрати. Для 12 місяців — компактний режим. */
export function BarChart({ data }: { data: Point[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.flatMap((p) => [p.income, p.expense]));
  const compact = data.length > 8;
  const barWidth = compact ? 7 : 12;

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.scale}>
        Шкала до {formatMoney(max)}
      </ThemedText>

      <View style={styles.bars}>
        {data.map((p) => (
          <View
            key={p.month}
            style={styles.group}
            accessible
            accessibilityLabel={`${monthLabel(p.month)}: дохід ${Math.round(p.income)}, витрати ${Math.round(p.expense)}`}>
            <View style={[styles.pair, { borderBottomColor: theme.border }]}>
              <View style={[styles.bar, { width: barWidth, height: barHeight(p.income, max), backgroundColor: theme.positive }]} />
              <View style={[styles.bar, { width: barWidth, height: barHeight(p.expense, max), backgroundColor: theme.negative }]} />
            </View>
            <ThemedText
              themeColor="textSecondary"
              numberOfLines={1}
              style={compact ? styles.labelCompact : styles.label}>
              {monthLabel(p.month)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <Legend color={theme.positive} label="Доходи" />
        <Legend color={theme.negative} label="Витрати" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  scale: { textAlign: 'right' },
  // flex-start: підпис однорядковий, тож групи не зсуваються по вертикалі
  bars: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { flex: 1, minWidth: 0, alignItems: 'center', gap: Spacing.one },
  pair: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  label: { fontSize: 13, lineHeight: 18 },
  labelCompact: { fontSize: 10, lineHeight: 14 },
  legend: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
