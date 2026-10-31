import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance, type ViewInstance } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthLabel, monthTitle } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { PeriodEntries } from '@/lib/reports';

import { ThemedText } from './themed-text';
import { TransactionRow } from './transaction-row';

type Point = { month: string; income: number; expense: number };

const CHART_HEIGHT = 120;
/** Висота плашки з місяцем і сумами: стала, щоб вона не стрибала */
const CALLOUT_HEIGHT = 60;

const barHeight = (value: number, max: number) => (value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 0);

/** Що саме було доходом і на що пішли витрати у вибраному стовпчику (місяць чи рік): його записи списком */
function MonthEntries({ month, scope }: { month: string; scope?: ChartScope }) {
  const theme = useTheme();
  const query = `period=${month}${scope?.carId ? `&carId=${scope.carId}` : ''}${scope?.dealId ? `&dealId=${scope.dealId}` : ''}`;
  const { data, loading, error } = useReport<PeriodEntries>(`/transactions/period?${query}`, { keepPrevious: true });
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
      ) : data.items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          За цей період записів немає
        </ThemedText>
      ) : (
        <>
          {data.items.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
              <TransactionRow tx={tx} car={showCar ? tx.car : undefined} />
            </View>
          ))}
          {data.total > data.items.length ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.more}>
              Показано {data.items.length} найновіших із {data.total}. Повний перелік є в експорті
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

/** Звідки брати записи вибраного місяця: усі записи користувача, лише авто чи лише оренди */
export type ChartScope = { carId?: string; dealId?: string };

/** Скільки стовпчиків ще вміщується на екрані без гортання; більше — графік гортається */
const FIT_MAX = 12;
/** Ширина однієї групи (місяця) під час гортання: не менше зручної цілі для дотику */
const SLOT = 44;

/**
 * Стовпчики доходів (зелені) і витрат (червоні). Місяць можна вибрати дотиком; суми
 * вибраного місяця показані над графіком, а під ним записи цього місяця: за що був дохід і на що пішли витрати.
 * До 12 стовпчиків графік вміщується на екрані (можна й вести пальцем). Довшу історію можна гортати вбік: стовпчики
 * лишаються зручної ширини, вибраним стає місяць по центру, тож свайп сам змінює місяць, а дотик ставить його в центр.
 */
export function BarChart({ data, scope }: { data: Point[]; scope?: ChartScope }) {
  const theme = useTheme();
  const [selected, setSelected] = useState(data.length - 1);
  // Положення графіка на екрані: за ним переводимо дотик пальця в номер місяця (лише без гортання)
  const [frame, setFrame] = useState({ x: 0, width: 0 });
  const [viewport, setViewport] = useState(0);
  const container = useRef<ViewInstance>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  const scrollable = data.length > FIT_MAX;
  const max = Math.max(1, ...data.flatMap((p) => [p.income, p.expense]));
  const compact = data.length > 8 && !scrollable;
  const barWidth = compact ? 7 : 12;
  const index = Math.max(0, Math.min(selected, data.length - 1));
  const current = data[index];

  /** Обирає стовпчик і, якщо графік гортається, виводить його в центр: там завжди стоїть вибраний місяць */
  const select = (i: number) => {
    const next = Math.max(0, Math.min(data.length - 1, i));
    setSelected(next);
    if (scrollable) scroller.current?.scrollTo({ x: next * SLOT, animated: true });
  };

  // Під час гортання вибраним стає місяць під центром, тож свайп сам змінює місяць
  const onScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(e.nativeEvent.contentOffset.x / SLOT)));
    setSelected((prev) => (prev === i ? prev : i));
  };

  // Записи місяця вантажимо, коли вибір зупинився: під час швидкого гортання не робимо запит на кожен місяць
  const [entriesMonth, setEntriesMonth] = useState(data[Math.min(selected, data.length - 1)]?.month ?? '');
  const selectedMonth = data[Math.max(0, Math.min(selected, data.length - 1))]?.month ?? '';
  useEffect(() => {
    const timer = setTimeout(() => setEntriesMonth(selectedMonth), 250);
    return () => clearTimeout(timer);
  }, [selectedMonth]);
  const initialised = useRef(false);

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

  const groups = data.map((p, i) => {
    const active = i === index;
    // Під гортанням підписуємо рік у січні та на першому стовпчику, щоб не загубитись у часі
    const year = scrollable && p.month.length === 7 && (i === 0 || p.month.endsWith('-01')) ? p.month.slice(0, 4) : '';
    return (
      <Pressable
        key={p.month}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${monthTitle(p.month)}: дохід ${Math.round(p.income)}, витрати ${Math.round(p.expense)}`}
        onPress={() => select(i)}
        style={[styles.group, scrollable && styles.slot, active && { backgroundColor: theme.accentSoft }]}>
        <View style={[styles.pair, { borderBottomColor: theme.border }, !active && styles.inactive]}>
          <View style={[styles.bar, { width: barWidth, height: barHeight(p.income, max), backgroundColor: theme.positive }]} />
          <View style={[styles.bar, { width: barWidth, height: barHeight(p.expense, max), backgroundColor: theme.negative }]} />
        </View>
        <ThemedText themeColor={active ? 'accent' : 'textSecondary'} numberOfLines={1} style={[compact ? styles.labelCompact : styles.label, active && styles.labelActive]}>
          {monthLabel(p.month)}
        </ThemedText>
        {scrollable ? (
          <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.yearLabel}>
            {year || ' '}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.callout, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {monthTitle(current.month)}
        </ThemedText>
        {/* Три сталі колонки в один рядок: плашка не міняє висоту, якою б довгою не була сума */}
        <View style={styles.calloutRow}>
          <ThemedText type="small" themeColor="positive" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.sumLeft}>
            +{formatMoney(current.income)}
          </ThemedText>
          <ThemedText type="small" themeColor="negative" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.sumCenter}>
            −{formatMoney(current.expense)}
          </ThemedText>
          <ThemedText type="smallBold" themeColor={profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.sumRight}>
            = {formatMoney(profit)}
          </ThemedText>
        </View>
      </View>

      {scrollable ? (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Місяць «чіпляється» до центру, а поля з боків дають змогу поставити в центр і перший, і останній
          snapToInterval={SLOT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, (viewport - SLOT) / 2) }}
          // Спершу показуємо найновіший місяць: останній стовпчик по центру
          onContentSizeChange={() => {
            if (viewport && !initialised.current) {
              initialised.current = true;
              scroller.current?.scrollTo({ x: (data.length - 1) * SLOT, animated: false });
            }
          }}>
          <View style={styles.bars}>{groups}</View>
        </ScrollView>
      ) : (
        <View
          ref={container}
          style={styles.bars}
          onLayout={() => container.current?.measureInWindow((x, _y, width) => setFrame({ x, width }))}
          {...pan.panHandlers}>
          {groups}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.legend}>
          <Legend color={theme.positive} label="Доходи" />
          <Legend color={theme.negative} label="Витрати" />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {scrollable ? 'Гортайте графік або торкайтесь місяця' : 'Торкніться або ведіть пальцем'}
        </ThemedText>
      </View>

      <MonthEntries month={entriesMonth || current.month} scope={scope} />
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
  // Сталої висоти: ні місяць, ні суми не переносяться, тож плашка й усе, що під нею, не стрибають під час гортання
  callout: { height: CALLOUT_HEIGHT, justifyContent: 'center', borderRadius: Radius.md, paddingHorizontal: Spacing.three, gap: Spacing.half },
  calloutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sumLeft: { flex: 1, textAlign: 'left' },
  sumCenter: { flex: 1, textAlign: 'center' },
  sumRight: { flex: 1, textAlign: 'right' },
  // flex-start: підпис однорядковий, тож групи не зсуваються по вертикалі
  bars: { flexDirection: 'row', alignItems: 'flex-start' },
  group: { flex: 1, minWidth: 0, alignItems: 'center', gap: Spacing.one, paddingTop: Spacing.one, paddingBottom: Spacing.half, borderRadius: Radius.sm },
  // Під гортанням кожна група має сталу ширину замість того, щоб стискатись
  slot: { flex: 0, width: SLOT },
  inactive: { opacity: 0.55 },
  pair: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  label: { fontSize: 13, lineHeight: 18 },
  labelCompact: { fontSize: 10, lineHeight: 14 },
  labelActive: { fontWeight: 700 },
  yearLabel: { fontSize: 11, lineHeight: 14 },
  entries: { gap: 0 },
  more: { paddingTop: Spacing.two },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 + Spacing.three },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.two },
  legend: { flexDirection: 'row', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
