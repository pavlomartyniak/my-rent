import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { PaybackCard } from '@/components/payback-card';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { formatDate, monthKey, monthLabel } from '@/lib/date';
import { expenseByCategory, filterByPeriod, monthlySeries, totals } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import { useFleet } from '@/store/fleet';

/** «≈ 2 р. 3 міс» */
function formatMonths(n: number) {
  const years = Math.floor(n / 12);
  const months = n % 12;
  return [years ? `${years} р.` : '', months ? `${months} міс` : ''].filter(Boolean).join(' ') || '< 1 міс';
}

export default function CarAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars, transactions } = useFleet();
  const p = usePeriod();
  const car = cars.find((c) => c.id === id);

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
  }

  const all = transactions.filter((t) => t.carId === car.id);
  const scoped = filterByPeriod(all, p.key);
  const sum = totals(scoped);

  // Показники за весь час
  const allTotals = totals(all);
  const since = [car.rentStart, ...all.map((t) => t.date)].sort()[0];
  const now = new Date();
  const monthsOwned = Math.max(1, (now.getFullYear() - Number(since.slice(0, 4))) * 12 + now.getMonth() - (Number(since.slice(5, 7)) - 1) + 1);
  const years = [...new Set(all.map((t) => t.date.slice(0, 4)))].sort().reverse().map((y) => ({ year: y, ...totals(filterByPeriod(all, y)) }));
  const expenseShare = allTotals.income > 0 ? (allTotals.expense / allTotals.income) * 100 : 0;
  const avgMonthly = allTotals.profit / monthsOwned;
  const left = car.price - allTotals.profit;
  const payback = left <= 0 ? 'Окупилось' : avgMonthly > 0 ? `≈ ${formatMonths(Math.ceil(left / avgMonthly))}` : '—';

  const byMonth = monthlySeries(all, [...new Set(all.map((t) => monthKey(t.date)))]).sort((a, b) => b.profit - a.profit);
  const best = byMonth[0];
  const worst = byMonth.length > 1 ? byMonth[byMonth.length - 1] : undefined;
  const monthName = (m: string) => `${monthLabel(m)} ${m.slice(0, 4)}`;

  return (
    <Screen>
      <Stack.Screen options={{ title: `${car.brand} ${car.model}` }} />

      <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={36} />

      <PeriodSwitcher state={p} />
      <SummaryCard title={`Прибуток · ${p.label}`} profit={sum.profit} income={sum.income} expense={sum.expense} />

      <Card>
        <BarChart data={monthlySeries(all, p.months)} />
      </Card>

      <SectionHeader title={`На що йдуть витрати · ${p.label}`} />
      <Card>
        <CategoryBreakdown items={expenseByCategory(scoped)} />
      </Card>

      <View style={styles.divider} />

      <SectionHeader title="За весь час володіння" />
      <SummaryCard
        title={`Прибуток · з ${formatDate(since)} (${formatMonths(monthsOwned)})`}
        profit={allTotals.profit}
        income={allTotals.income}
        expense={allTotals.expense}
        note={`Витрати складають ${Math.round(expenseShare)}% від доходів · записів: ${all.length}`}
      />

      <PaybackCard profit={allTotals.profit} price={car.price} eta={payback} />

      <View style={styles.grid}>
        <Stat label="Прибуток / міс" value={formatMoney(avgMonthly)} color={avgMonthly >= 0 ? 'positive' : 'negative'} />
        <Stat label="Витрати / міс" value={formatMoney(allTotals.expense / monthsOwned)} />
      </View>
      <View style={styles.grid}>
        <Stat label="Найкращий місяць" value={best ? monthName(best.month) : '—'} note={best ? formatMoney(best.profit) : undefined} color="positive" />
        <Stat label="Найгірший місяць" value={worst ? monthName(worst.month) : '—'} note={worst ? formatMoney(worst.profit) : undefined} color={worst && worst.profit < 0 ? 'negative' : undefined} />
      </View>

      <SectionHeader title="По роках" />
      <Card style={styles.years}>
        {years.map((y, i) => (
          <View key={y.year} style={[styles.yearRow, i > 0 && styles.yearBorder]}>
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold}>
                {y.year}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Дохід {formatMoney(y.income)} · Витрати {formatMoney(y.expense)}
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.bold} themeColor={y.profit >= 0 ? 'positive' : 'negative'}>
              {formatMoney(y.profit)}
            </ThemedText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Витрати за весь час" />
      <Card>
        <CategoryBreakdown items={expenseByCategory(all)} />
      </Card>
    </Screen>
  );
}

function Stat({ label, value, note, color }: { label: string; value: string; note?: string; color?: ThemeColor }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.statValue} themeColor={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 16 / 7, borderRadius: Radius.lg },
  grid: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one },
  divider: { height: Spacing.two },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  years: { paddingVertical: 0, gap: 0 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  yearBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)' },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
});
