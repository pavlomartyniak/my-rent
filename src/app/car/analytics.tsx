import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { PaybackCard } from '@/components/payback-card';
import { ExportButton } from '@/components/export-sheet';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { formatDate, monthLabel } from '@/lib/date';
import { formatMoney, formatMonths } from '@/lib/format';
import type { CarReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const monthName = (m: string) => `${monthLabel(m)} ${m.slice(0, 4)}`;

export default function CarAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cars } = useFleet();
  const p = usePeriod();
  const car = cars.find((c) => c.id === id);
  // Усі цифри рахує сервер
  const { data: report, loading, error, retry } = useReport<CarReport>(car ? `/reports/cars/${car.id}?period=${p.key}` : null);

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${car.brand} ${car.model}` }} />

      <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={36} />

      <PeriodSwitcher state={p} />

      {!report ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <CarReportView report={report} carId={car.id} price={car.price} periodLabel={p.label} periodKey={p.key} />
          <ExportButton filter={{ carId: car.id, period: p.key }} subtitle={`${car.brand} ${car.model} · ${p.label}`} title={`Експорт за ${p.label}`} />
        </>
      )}
    </Screen>
  );
}

function CarReportView({ report, carId, price, periodLabel, periodKey }: { report: CarReport; carId: string; price: number; periodLabel: string; periodKey: string }) {
  const { overview, totals, best, worst } = report;
  const eta = overview.paybackMonths === 0 ? 'Окупилось' : overview.paybackMonths ? `≈ ${formatMonths(overview.paybackMonths)}` : '—';

  return (
    <>
      <SummaryCard title={`Прибуток · ${periodLabel}`} profit={totals.profit} income={totals.income} expense={totals.expense} />

      <Card>
        <BarChart key={periodKey} data={report.series} scope={{ carId }} />
      </Card>

      <SectionHeader title={`На що йдуть витрати · ${periodLabel}`} />
      <Card>
        <CategoryBreakdown items={report.categories} />
      </Card>

      <View style={styles.divider} />

      <SectionHeader title="За весь час володіння" />
      <SummaryCard
        title={`Прибуток · з ${formatDate(overview.since)} (${formatMonths(overview.monthsOwned)})`}
        profit={overview.profit}
        income={overview.income}
        expense={overview.expense}
        note={overview.expenseShare === null ? undefined : `Витрати складають ${Math.round(overview.expenseShare)}% від доходів`}
      />

      <PaybackCard profit={overview.profit} price={price} eta={eta} />

      <View style={styles.grid}>
        <Stat label="Прибуток / міс" value={formatMoney(overview.avgMonthly)} color={overview.avgMonthly >= 0 ? 'positive' : 'negative'} />
        <Stat label="Витрати / міс" value={formatMoney(overview.expense / overview.monthsOwned)} />
      </View>
      <View style={styles.grid}>
        <Stat label="Найкращий місяць" value={best ? monthName(best.month) : '—'} note={best ? formatMoney(best.profit) : undefined} color="positive" />
        <Stat label="Найгірший місяць" value={worst ? monthName(worst.month) : '—'} note={worst ? formatMoney(worst.profit) : undefined} color={worst && worst.profit < 0 ? 'negative' : undefined} />
      </View>

      <SectionHeader title="По роках" />
      <Card style={styles.years}>
        {report.years.map((y, i) => (
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
        <CategoryBreakdown items={report.allCategories} />
      </Card>
    </>
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
