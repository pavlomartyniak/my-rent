import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthLabel, monthTitle } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { MonthEntry } from '@/lib/reports';

import { ThemedText } from './themed-text';
import { TransactionRow } from './transaction-row';

type Point = { month: string; income: number; expense: number };

const CHART_HEIGHT = 120;

const barHeight = (value: number, max: number) => (value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 0);

/** Що саме було доходом і на що пішли витрати у вибраному місяці: записи цього місяця списком */
function MonthEntries({ month, scope }: { month: string; scope?: ChartScope }) {
  const theme = useTheme();
  const query = `month=${month}${scope?.carId ? `&carId=${scope.carId}` : ''}${scope?.dealId ? `&dealId=${scope.dealId}` : ''}`;
  const { data, loading, error } = useReport<MonthEntry[]>(`/transactions/month?${query}`, { keepPrevious: true });
  // Назву авто показуємо лише там, де записи охоплюють кілька авто
  const showCar = !scope?.carId && !scope?.dealId;

  return (
    <View style={styles.entries}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Записи · {monthTitle(month)}
      </ThemedText>
      {!data ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error ?? (loading ? 'Завантажуємо…' : '')}
        </ThemedText>
      ) : data.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          За цей місяць записів немає
        </ThemedText>
      ) : (
        data.map((tx, i) => (
          <View key={tx.id}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
            <TransactionRow tx={tx} car={showCar ? tx.car : undefined} />
          </View>
        ))
      )}
    </View>
  );
}

/** Звідки брати записи вибраного місяця: усі записи користувача, лише авто чи лише оренди */
export type ChartScope = { carId?: string; dealId?: string };

/**
 * Стовпчики доходів (зелені) і витрат (червоні). Місяць можна вибрати дотиком
 * або вести пальцем уздовж графіка; суми вибраного місяця показані над ним, а під графіком
 * записи цього місяця: за що був дохід і на що пішли витрати.
 */
export function BarChart({ data, scope }: { data: Point[]; scope?: ChartScope }) {
  const theme = useTheme();
  const [selected, setSelected] = useState(data.length - 1);
  // Положення графіка на екрані: за ним переводимо дотик пальця в номер місяця
  const [frame, setFrame] = useState({ x: 0, width: 0 });
  const container = useRef<ViewInstance>(null);

  const max = Math.max(1, ...data.flatMap((p) => [p.income, p.expense]));
  const compact = data.length > 8;
  const barWidth = compact ? 7 : 12;
  const index = Math.max(0, Math.min(selected, data.length - 1));
  const current = data[index];

  const pan = useMemo(() => {
    const pick = (pageX: number) => {
      if (!frame.width) return;
      const i = Math.floor(((pageX - frame.x) / frame.width) * data.length);
      setSelected(Math.max(0, Math.min(data.length - 1, i)));
    };
    return PanResponder.create({
      // Перехоплюємо лише горизонтальний рух, щоб вертикальна прокрутка екрана працювала
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => pick(e.nativeEvent.pageX),
      onPanResponderMove: (e) => pick(e.nativeEvent.pageX),
      onPanResponderTerminationRequest: () => false,
    });
  }, [frame, data.length]);

  if (!current) return null;
  const profit = current.income - current.expense;

  return (
    <View style={styles.wrap}>
      <View style={[styles.callout, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{monthTitle(current.month)}</ThemedText>
        <View style={styles.calloutRow}>
          <ThemedText type="small" themeColor="positive">
            +{formatMoney(current.income)}
          </ThemedText>
          <ThemedText type="small" themeColor="negative">
            −{formatMoney(current.expense)}
          </ThemedText>
          <ThemedText type="smallBold" themeColor={profit >= 0 ? 'positive' : 'negative'}>
            = {formatMoney(profit)}
          </ThemedText>
        </View>
      </View>

      <View
        ref={container}
        style={styles.bars}
        onLayout={() => container.current?.measureInWindow((x, _y, width) => setFrame({ x, width }))}
        {...pan.panHandlers}>
        {data.map((p, i) => {
          const active = i === index;
          return (
            <Pressable
              key={p.month}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${monthTitle(p.month)}: дохід ${Math.round(p.income)}, витрати ${Math.round(p.expense)}`}
              onPress={() => setSelected(i)}
              style={[styles.group, active && { backgroundColor: theme.accentSoft }]}>
              <View style={[styles.pair, { borderBottomColor: theme.border }, !active && styles.inactive]}>
                <View style={[styles.bar, { width: barWidth, height: barHeight(p.income, max), backgroundColor: theme.positive }]} />
                <View style={[styles.bar, { width: barWidth, height: barHeight(p.expense, max), backgroundColor: theme.negative }]} />
              </View>
              <ThemedText themeColor={active ? 'accent' : 'textSecondary'} numberOfLines={1} style={[compact ? styles.labelCompact : styles.label, active && styles.labelActive]}>
                {monthLabel(p.month)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.legend}>
          <Legend color={theme.positive} label="Доходи" />
          <Legend color={theme.negative} label="Витрати" />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Торкніться або ведіть пальцем
        </ThemedText>
      </View>

      <MonthEntries month={current.month} scope={scope} />
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
  wrap: { gap: Spacing.three },
  callout: { borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.half },
  calloutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  // flex-start: підпис однорядковий, тож групи не зсуваються по вертикалі
  bars: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { flex: 1, minWidth: 0, alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.one, paddingBottom: Spacing.half, borderRadius: Radius.sm },
  inactive: { opacity: 0.55 },
  pair: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  label: { fontSize: 13, lineHeight: 18 },
  labelCompact: { fontSize: 10, lineHeight: 14 },
  labelActive: { fontWeight: 700 },
  entries: { gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 + Spacing.three },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  legend: { flexDirection: 'row', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
