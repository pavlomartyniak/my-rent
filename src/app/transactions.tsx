import { useAddTransaction } from '@/components/transaction-sheet';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { CategoryBreakdown } from '@/components/category-breakdown';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SwitchTabs } from '@/components/ui/switch-tabs';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, monthTitle, shiftMonth, todayISO } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { PeriodEntries } from '@/lib/reports';

const MODES = ['Місяць', 'Рік', 'Весь час', 'Діапазон'] as const;
type Mode = (typeof MODES)[number];
type Kind = 'Усі' | 'Доходи' | 'Витрати';
const KINDS: readonly Kind[] = ['Усі', 'Доходи', 'Витрати'];
const VIEWS = ['Список', 'Діаграма'] as const;
type View_ = (typeof VIEWS)[number];

/** Тип записів: широкі вкладки зі своїм кольором для кожного типу, щоб відрізнялись від чипів періоду */
function KindTabs({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  const theme = useTheme();
  const tint = (k: Kind) => (k === 'Доходи' ? { bg: theme.positiveSoft, fg: theme.positive } : k === 'Витрати' ? { bg: theme.negativeSoft, fg: theme.negative } : { bg: theme.ink, fg: theme.onInk });
  return (
    <View style={[styles.kinds, { borderColor: theme.border }]} accessibilityRole="tablist">
      {KINDS.map((k) => {
        const on = k === value;
        const c = tint(k);
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)} style={[styles.kind, on && { backgroundColor: c.bg }]}>
            <ThemedText type="smallBold" style={{ color: on ? c.fg : theme.textSecondary }}>
              {k}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Додати запис: компактна кольорова таблетка біля суми. У «Усі» тип запитуємо в меню */
function AddButton({ kind, onAdd }: { kind: Kind; onAdd: (t: 'income' | 'expense') => void }) {
  const theme = useTheme();
  const bg = kind === 'Доходи' ? theme.positive : kind === 'Витрати' ? theme.negative : theme.ink;
  const label = kind === 'Доходи' ? 'Дохід' : kind === 'Витрати' ? 'Витрата' : 'Запис';
  function press() {
    if (kind === 'Доходи') return onAdd('income');
    if (kind === 'Витрати') return onAdd('expense');
    Alert.alert('Новий запис', 'Що додати?', [
      { text: 'Дохід', onPress: () => onAdd('income') },
      { text: 'Витрату', onPress: () => onAdd('expense') },
      { text: 'Скасувати', style: 'cancel' },
    ]);
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Додати: ${label.toLowerCase()}`} onPress={press} style={({ pressed }) => [styles.addPill, { backgroundColor: bg }, pressed && { opacity: 0.8 }]}>
      <Icon name="add" size={20} color={theme.onInk} />
      <ThemedText type="smallBold" style={{ color: theme.onInk }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const TYPE_OF: Record<Kind, 'income' | 'expense' | undefined> = { Усі: undefined, Доходи: 'income', Витрати: 'expense' };
const SCREEN_TITLE: Record<Kind, string> = { Усі: 'Записи', Доходи: 'Дохід', Витрати: 'Витрати' };

/**
 * Записи за період: відкривається з плашок «Дохід» і «Витрати» (чи з місячного підсумку) на екранах із підсумками.
 * Період можна змінити (місяць, рік, весь час чи довільний діапазон днів), тип записів перемикається, а замість списку
 * можна подивитись кільцеву діаграму за категоріями: натискання на категорію відкриває її записи.
 */
export default function TransactionsScreen() {
  const theme = useTheme();
  const addTransaction = useAddTransaction();
  const { period, type, carId, dealId } = useLocalSearchParams<{ period?: string; type?: 'income' | 'expense'; carId?: string; dealId?: string; label?: string }>();
  const today = todayISO();
  const current = today.slice(0, 7);

  // Стартовий період береться з плашки, з якої відкрили екран
  const [mode, setMode] = useState<Mode>(period === 'all' || !period ? 'Весь час' : /^\d{4}$/.test(period) ? 'Рік' : 'Місяць');
  const [month, setMonth] = useState(period && /^\d{4}-\d{2}$/.test(period) ? period : period && /^\d{4}$/.test(period) ? `${period}-01` : current);
  const [from, setFrom] = useState(`${current}-01`);
  const [to, setTo] = useState(today);
  // Стартовий тип записів задає плашка, з якої відкрили екран («Дохід», «Витрати» чи підсумок); далі його можна перемикати тут же
  const [kind, setKind] = useState<Kind>(type === 'income' ? 'Доходи' : type === 'expense' ? 'Витрати' : 'Усі');
  const [view, setView] = useState<View_>('Список');
  const [category, setCategory] = useState<string | undefined>();

  const yearly = mode === 'Рік';
  const key = mode === 'Весь час' ? 'all' : yearly ? month.slice(0, 4) : month;
  const rangeInvalid = mode === 'Діапазон' && from > to;
  const step = yearly ? 12 : 1;
  const atEnd = yearly ? month.slice(0, 4) >= current.slice(0, 4) : month >= current;
  const periodText =
    mode === 'Весь час' ? 'За весь час' : mode === 'Діапазон' ? `${formatDate(from)} – ${formatDate(to)}` : yearly ? month.slice(0, 4) : monthTitle(month);

  const apiType = TYPE_OF[kind];
  const query = [
    `period=${mode === 'Діапазон' ? 'all' : key}`,
    mode === 'Діапазон' && `from=${from}`,
    mode === 'Діапазон' && `to=${to}`,
    apiType && `type=${apiType}`,
    category && `category=${encodeURIComponent(category)}`,
    carId && `carId=${carId}`,
    dealId && `dealId=${dealId}`,
  ]
    .filter(Boolean)
    .join('&');
  const { data, loading, error, retry } = useReport<PeriodEntries>(rangeInvalid ? null : `/transactions/period?${query}`, { keepPrevious: true, refetchOnFocus: true });

  // Назву авто показуємо лише там, де записи охоплюють кілька авто
  const showCar = !carId && !dealId;
  const complete = !!data && data.total <= data.items.length;
  // Тип для суми: обраний плашкою, а в підсумку без типу — тип категорії, яку вибрали на діаграмі
  const effType = apiType ?? (category && data ? (data.breakdown.income.some((c) => c.category === category) ? 'income' : 'expense') : undefined);
  const tone = effType === 'expense' ? 'negative' : effType === 'income' ? 'positive' : (data?.totals.profit ?? 0) >= 0 ? 'positive' : 'negative';
  // Сума: за типом; з категорією беремо її власну суму з розподілу
  const categorySum = category && data && effType ? data.breakdown[effType].find((c) => c.category === category)?.amount : undefined;
  const shown = !data ? 0 : effType === 'expense' ? data.totals.expense : effType === 'income' ? data.totals.income : data.totals.profit;

  const addEntry = (t: 'income' | 'expense') => addTransaction({ type: t, carId, dealId });

  return (
    <Screen>
      <Stack.Screen options={{ title: SCREEN_TITLE[kind], headerBackTitle: 'Назад' }} />

      <KindTabs
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategory(undefined);
        }}
      />

      <Segmented
        scroll
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setCategory(undefined);
        }}
      />

      {mode === 'Діапазон' ? (
        <View style={styles.range}>
          <DateField label="Від" value={from} onChange={setFrom} />
          <DateField label="До" value={to} onChange={setTo} />
        </View>
      ) : mode === 'Весь час' ? null : (
        <View style={styles.stepper}>
          <IconButton icon="chevron-back" label="Назад" onPress={() => setMonth(shiftMonth(month, -step))} />
          <ThemedText type="default" style={styles.bold}>
            {periodText}
          </ThemedText>
          <IconButton icon="chevron-forward" label="Вперед" disabled={atEnd} onPress={() => setMonth(shiftMonth(month, step))} />
        </View>
      )}
      {rangeInvalid ? (
        <ThemedText type="small" themeColor="negative" accessibilityRole="alert">
          Початок діапазону пізніший за кінець.
        </ThemedText>
      ) : null}

      {rangeInvalid ? null : !data ? (
        <ReportStatus shape="list" loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <View style={styles.headRow}>
            <View style={styles.head}>
              <ThemedText type="small" themeColor="textSecondary">
                {periodText} · {data.total}
              </ThemedText>
              <ThemedText style={styles.total} themeColor={tone} numberOfLines={1} adjustsFontSizeToFit>
                {effType === 'expense' ? '−' : effType === 'income' ? '+' : shown >= 0 ? '' : '−'}
                {formatMoney(Math.abs(category && categorySum !== undefined ? categorySum : shown))}
              </ThemedText>
              {!effType ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Дохід {formatMoney(data.totals.income)} · Витрати {formatMoney(data.totals.expense)}
                </ThemedText>
              ) : null}
            </View>
            <AddButton kind={kind} onAdd={addEntry} />
          </View>

          {/* Для одного типу — одна діаграма; для підсумку (доходи разом із витратами) — окремо доходи й окремо витрати */}
          <SwitchTabs options={VIEWS} value={view} onChange={setView} />

          {category ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Прибрати фільтр: ${category}`} onPress={() => setCategory(undefined)} style={[styles.filter, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {category}
              </ThemedText>
              <Icon name="close" size={14} color="accent" />
            </Pressable>
          ) : null}

          {view === 'Діаграма' ? (
            <>
              {(apiType ? [apiType] : (['income', 'expense'] as const)).map((t) => (
                <View key={t} style={styles.chart}>
                  {!apiType ? (
                    <ThemedText type="default" style={styles.bold}>
                      {t === 'income' ? 'Доходи' : 'Витрати'}
                    </ThemedText>
                  ) : null}
                  <CategoryBreakdown
                    items={data.breakdown[t]}
                    label={t === 'income' ? 'доходи' : 'витрати'}
                    emptyText={t === 'income' ? 'Доходів за цей період немає.' : 'Витрат за цей період немає.'}
                    onSelect={(c) => {
                      setCategory(c);
                      setView('Список');
                    }}
                  />
                </View>
              ))}
              {data.breakdown.income.length || data.breakdown.expense.length ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  Натисніть на категорію, щоб побачити її записи.
                </ThemedText>
              ) : null}
            </>
          ) : data.items.length === 0 ? (
            <EmptyState icon="receipt-outline" title="Записів немає" text="За цей період тут нічого не було." />
          ) : (
            <>
              <Card style={styles.card}>
                {data.items.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                    <TransactionRow tx={tx} car={showCar ? tx.car : undefined} />
                  </View>
                ))}
              </Card>
              {!complete ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  Показано {data.items.length} найновіших із {data.total}. Звузьте період, щоб побачити решту.
                </ThemedText>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  range: { gap: Spacing.three },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: { flexDirection: 'row', gap: Spacing.two },
  head: { flex: 1, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  kinds: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, padding: 4, gap: 4 },
  kind: { flex: 1, minHeight: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 999, marginBottom: 4 },
  total: { ...Type.hero },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  card: { paddingVertical: 0, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 + Spacing.three },
  chart: { gap: Spacing.three },
  note: { textAlign: 'center' },
});
