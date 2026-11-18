import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { CarReportView } from '@/components/car-report-view';
import { ScopeFilter } from '@/components/scope-filter';
import { Button } from '@/components/ui/button';
import { CategoryPanel } from '@/components/category-panel';
import { ComparisonCard } from '@/components/comparison-card';
import { ExportButton, ExportIconButton } from '@/components/export-sheet';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle } from '@/lib/date';
import { formatMoney, formatMonths, formatPercent } from '@/lib/format';
import type { CarReport, SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const CRITERIA = ['Прибуток', 'ROI', 'Окупність'] as const;
type Criterion = (typeof CRITERIA)[number];

/** Для сортування за окупністю: вже окупились — першими, невідомо — останніми */
const paybackRank = (months: number | null) => (months === null ? Infinity : months === 0 ? -1 : months);

export default function ReportScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { cars } = useFleet();
  const p = usePeriod();
  const [criterion, setCriterion] = useState<Criterion>('Прибуток');
  // `?carId=` відкриває розділ уже з вибраним авто (перехід із картки авто); власний вибір діє, доки параметр той самий
  const params = useLocalSearchParams<{ carId?: string }>();
  const [pick, setPick] = useState<{ param?: string; id: string | null }>();
  const carId = pick && pick.param === params.carId ? pick.id : (params.carId ?? null);
  const car = cars.find((c) => c.id === carId);
  const { data, loading, error, retry } = useReport<SummaryReport>(car ? null : `/reports/summary?period=${p.key}`);
  const carReport = useReport<CarReport>(car ? `/reports/cars/${car.id}?period=${p.key}` : null);

  const monthly = p.key.length === 7;

  // Усі цифри рахує сервер; тут лише поєднуємо їх із даними авто й сортуємо за вибраним критерієм
  const ranking = (data?.cars ?? [])
    .flatMap((row) => {
      const car = cars.find((c) => c.id === row.carId);
      return car ? [{ car, period: row.period, all: row.overview }] : [];
    })
    .sort((a, b) =>
      criterion === 'Прибуток'
        ? b.period.profit - a.period.profit
        : criterion === 'ROI'
          ? b.all.roi - a.all.roi
          : paybackRank(a.all.paybackMonths) - paybackRank(b.all.paybackMonths),
    );

  return (
    <Screen tabs>
      <ScreenTitle actions={<ExportIconButton filter={{ period: p.key, ...(car ? { carId: car.id } : {}) }} subtitle={`${car ? `${car.brand} ${car.model}` : 'Усі авто'} · ${p.label}`} />}>Доходи</ScreenTitle>

      {cars.length > 1 ? (
        <ScopeFilter
          label="Авто"
          allLabel="Усі авто"
          options={cars.map((c) => ({ id: c.id, label: `${c.brand} ${c.model}` }))}
          value={car?.id ?? null}
          onChange={(id) => setPick({ param: params.carId, id })}
        />
      ) : null}

      <PeriodSwitcher state={p} />

      {car ? (
        carReport.data ? (
          <>
            <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push({ pathname: '/transaction/new', params: { carId: car.id } })} />
            <CarReportView report={carReport.data} carId={car.id} price={car.price} periodLabel={p.label} periodKey={p.key} exportSubtitle={`${car.brand} ${car.model} · ${p.label}`} />
          </>
        ) : (
          <ReportStatus loading={carReport.loading} error={carReport.error} onRetry={carReport.retry} />
        )
      ) : !data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <SummaryCard
            title={`Прибуток · ${p.label}`}
            profit={data.totals.profit}
            income={data.totals.income}
            expense={data.totals.expense}
            change={data.previousPeriod ? data.change.profit : undefined}
            margin={data.totals.margin}
            scope={{ period: p.key, label: p.label }}>
            <View style={styles.export}>
              <ExportButton filter={{ period: p.key }} subtitle={`Усі авто · ${p.label}`} title={`Експорт за ${p.label}`} />
            </View>
          </SummaryCard>

          {data.previousPeriod ? (
            <ComparisonCard
              title={monthly ? 'Порівняно з минулим місяцем' : 'Порівняно з минулим роком'}
              previousLabel={monthly ? monthTitle(data.previousPeriod) : data.previousPeriod}
              report={data}
            />
          ) : null}

          <BarChart key={p.key} data={data.series} card />

          <Button title="Додати дохід або витрату" icon="add" onPress={() => router.push('/transaction/new')} />

          <SectionHeader title="Рейтинг авто" />
          <Segmented scroll options={CRITERIA} value={criterion} onChange={setCriterion} />
          <Card style={styles.list}>
            {ranking.map(({ car, period, all }, i) => {
              const main =
                criterion === 'Прибуток'
                  ? { text: formatMoney(period.profit), good: period.profit >= 0 }
                  : criterion === 'ROI'
                    ? { text: formatPercent(all.roi), good: all.roi >= 0 }
                    : all.paybackMonths === 0
                      ? { text: 'Окупилось', good: true }
                      : { text: all.paybackMonths ? `≈ ${formatMonths(all.paybackMonths)}` : '—', good: null };
              // Смуга порівнює авто за вибраним показником; для окупності її немає
              const value = criterion === 'Прибуток' ? period.profit : criterion === 'ROI' ? all.roi : null;
              const top = Math.max(0, ...ranking.map((r) => (criterion === 'Прибуток' ? r.period.profit : r.all.roi)));
              const share = value === null ? null : top > 0 ? Math.max(0, value) / top : 0;
              const sub = criterion === 'ROI' ? `Прибуток за весь час ${formatMoney(all.profit)}` : `ROI ${formatPercent(all.roi)}`;

              return (
                <Pressable key={car.id} accessibilityRole="button" onPress={() => setPick({ param: params.carId, id: car.id })}>
                  <View style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={[styles.place, { backgroundColor: i === 0 ? theme.ink : theme.backgroundSelected }]}>
                      <ThemedText type="smallBold" style={{ color: i === 0 ? theme.onInk : theme.textSecondary }}>
                        {i + 1}
                      </ThemedText>
                    </View>
                    <CarPhoto uri={car.photoUri} style={styles.thumb} iconSize={22} />
                    <View style={styles.flex}>
                      <View style={styles.top}>
                        <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                          {car.brand} {car.model}
                        </ThemedText>
                        <ThemedText type="default" style={styles.value} themeColor={main.good === null ? 'text' : main.good ? 'positive' : 'negative'}>
                          {main.text}
                        </ThemedText>
                      </View>
                      {share !== null ? (
                        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                          <View style={[styles.fill, { backgroundColor: main.good === false ? theme.negative : theme.positive, width: `${Math.round(share * 100)}%` }]} />
                        </View>
                      ) : null}
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {sub}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </Card>

          <SectionHeader title="На що йдуть витрати" />
          <Card>
            <CategoryPanel />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)' },
  place: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 52, height: 52, borderRadius: Radius.md },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  fill: { height: 6, borderRadius: 3 },
  export: { marginTop: Spacing.two },
  bold: { fontWeight: 600 },
  value: { fontWeight: 600, textAlign: 'right', flexShrink: 0 },
});
