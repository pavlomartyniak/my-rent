import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/bar-chart';
import { AnalyticsHeader } from '@/components/analytics-header';
import { CategoryPanel } from '@/components/category-panel';
import { PaybackCard } from '@/components/payback-card';
import { ExportButton } from '@/components/export-sheet';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SplitBar } from '@/components/split-bar';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { formatDate, monthLabel } from '@/lib/date';
import { formatMoney, formatMonths } from '@/lib/format';
import type { CarReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const monthName = (m: string) => `${monthLabel(m)} ${m.slice(0, 4)}`;

export default function CarAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
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
    // Свій заголовок із фото авто замість системного хедера: відступ під статус-бар задаємо вручну
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: insets.top + Spacing.two }}>
      <Stack.Screen options={{ headerShown: false }} />

      <AnalyticsHeader photoUri={car.photoUri} title={`${car.brand} ${car.model}`} subtitle="Аналітика й окупність" />

      <PeriodSwitcher state={p} />

      {!report ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <CarReportView report={report} carId={car.id} price={car.price} periodLabel={p.label} periodKey={p.key} exportSubtitle={`${car.brand} ${car.model} · ${p.label}`} />
      )}
    </Screen>
  );
}

function CarReportView({ report, carId, price, periodLabel, periodKey, exportSubtitle }: { report: CarReport; carId: string; price: number; periodLabel: string; periodKey: string; exportSubtitle: string }) {
  const { overview, totals, best, worst } = report;
  const eta = overview.paybackMonths === 0 ? 'Окупилось' : overview.paybackMonths ? `≈ ${formatMonths(overview.paybackMonths)}` : '—';

  return (
    <>
      <SummaryCard title={`Прибуток · ${periodLabel}`} profit={totals.profit} income={totals.income} expense={totals.expense}>
        <View style={styles.export}>
          <ExportButton filter={{ carId, period: periodKey }} subtitle={exportSubtitle} title={`Експорт за ${periodLabel}`} />
        </View>
      </SummaryCard>

      <Card>
        <BarChart key={periodKey} data={report.series} scope={{ carId }} titled />
      </Card>

      <Card>
        <CategoryPanel carId={carId} title="На що йдуть витрати" />
      </Card>

      <View style={styles.divider} />

      <View>
        <SectionHeader title="За весь час володіння" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.since}>
          з {formatDate(overview.since)} · {formatMonths(overview.monthsOwned)}
        </ThemedText>
      </View>
      <SummaryCard title="Прибуток" profit={overview.profit} income={overview.income} expense={overview.expense}>
        {overview.expenseShare !== null ? (
          <View style={styles.share}>
            <SplitBar income={overview.income} expense={overview.expense} />
            <ThemedText type="small" themeColor="textSecondary">
              Витрати складають{' '}
              <ThemedText type="smallBold" themeColor="negative">
                {Math.round(overview.expenseShare)}%
              </ThemedText>{' '}
              від доходів
            </ThemedText>
          </View>
        ) : null}
      </SummaryCard>

      <PaybackCard profit={overview.profit} price={price} eta={eta} />

      <View style={styles.grid}>
        <Stat label="Прибуток / міс" value={formatMoney(overview.avgMonthly)} color={overview.avgMonthly >= 0 ? 'positive' : 'negative'} />
        <Stat label="Витрати / міс" value={formatMoney(overview.expense / overview.monthsOwned)} />
      </View>
      <View style={styles.grid}>
        <Stat icon="trending-up" label="Найкращий місяць" value={best ? monthName(best.month) : '—'} note={best ? formatMoney(best.profit) : undefined} color="positive" />
        <Stat icon="trending-down" label="Найгірший місяць" value={worst ? monthName(worst.month) : '—'} note={worst ? formatMoney(worst.profit) : undefined} color={worst && worst.profit < 0 ? 'negative' : undefined} />
      </View>

      <SectionHeader title="По роках" />
      <View style={styles.yearList}>
        {report.years.map((y) => (
          <Card key={y.year} style={styles.year}>
            <View style={styles.between}>
              <ThemedText type="default" style={styles.yearTitle}>
                {y.year}
              </ThemedText>
              <ThemedText type="default" style={styles.yearTitle} themeColor={y.profit >= 0 ? 'positive' : 'negative'}>
                {formatMoney(y.profit)}
              </ThemedText>
            </View>
            <SplitBar income={y.income} expense={y.expense} />
            <View style={styles.between}>
              <ThemedText type="small" themeColor="textSecondary">
                Дохід <ThemedText type="smallBold" themeColor="positive">{formatMoney(y.income)}</ThemedText>
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Витрати <ThemedText type="smallBold" themeColor="negative">{formatMoney(y.expense)}</ThemedText>
              </ThemedText>
            </View>
          </Card>
        ))}
      </View>
    </>
  );
}

function Stat({ label, value, note, color, icon }: { label: string; value: string; note?: string; color?: ThemeColor; icon?: 'trending-up' | 'trending-down' }) {
  return (
    <Card style={styles.stat}>
      <View style={styles.statHead}>
        {icon ? <Icon name={icon} size={14} color={color ?? 'textSecondary'} /> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
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
  export: { marginTop: Spacing.two },
  since: { marginTop: Spacing.one },
  share: { gap: Spacing.two, marginTop: Spacing.two },
  grid: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: Spacing.two },
  flex: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  yearList: { gap: Spacing.three },
  year: { gap: Spacing.two, padding: Spacing.four },
  yearTitle: { fontWeight: 700, fontSize: 18 },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
});
