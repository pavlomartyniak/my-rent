import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { ComparisonCard } from '@/components/comparison-card';
import { Hint } from '@/components/hint';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { monthTitle } from '@/lib/date';
import { formatMoney, formatMonths, formatPercent } from '@/lib/format';
import type { SummaryReport } from '@/lib/reports';
import { useFleet } from '@/store/fleet';

const CRITERIA = ['Прибуток', 'ROI', 'Окупність'] as const;
type Criterion = (typeof CRITERIA)[number];

/** Для сортування за окупністю: вже окупились — першими, невідомо — останніми */
const paybackRank = (months: number | null) => (months === null ? Infinity : months === 0 ? -1 : months);

export default function ReportScreen() {
  const router = useRouter();
  const { cars } = useFleet();
  const p = usePeriod();
  const [criterion, setCriterion] = useState<Criterion>('Прибуток');
  const { data, loading, error, retry } = useReport<SummaryReport>(`/reports/summary?period=${p.key}`);

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
      <ThemedText type="subtitle">Звіт</ThemedText>

      <Hint id="report-v2">
        Торкніться місяця на графіку або ведіть по ньому пальцем, щоб побачити суми. Рейтинг можна перемикати: прибуток, ROI, окупність. Тап по авто відкриває його окремий звіт.
      </Hint>

      <PeriodSwitcher state={p} />

      {!data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <SummaryCard title={`Прибуток · ${p.label}`} profit={data.totals.profit} income={data.totals.income} expense={data.totals.expense} />

          <ComparisonCard
            title={monthly ? 'Порівняно з минулим місяцем' : 'Порівняно з минулим роком'}
            previousLabel={monthly ? monthTitle(data.previousPeriod) : data.previousPeriod}
            report={data}
          />

          <Card>
            <BarChart key={p.key} data={data.series} />
          </Card>

          <SectionHeader title="Рейтинг авто" />
          <Segmented options={CRITERIA} value={criterion} onChange={setCriterion} />
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
              const sub = criterion === 'ROI' ? `Прибуток за весь час ${formatMoney(all.profit)}` : `ROI ${formatPercent(all.roi)}`;

              return (
                <Pressable key={car.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/car/analytics', params: { id: car.id } })}>
                  <View style={[styles.row, i > 0 && styles.rowBorder]}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.place}>
                      {i + 1}
                    </ThemedText>
                    <CarPhoto uri={car.photoUri} style={styles.thumb} iconSize={22} />
                    <View style={styles.flex}>
                      <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                        {car.brand} {car.model}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {sub}
                      </ThemedText>
                    </View>
                    <ThemedText type="default" style={styles.bold} themeColor={main.good === null ? 'text' : main.good ? 'positive' : 'negative'}>
                      {main.text}
                    </ThemedText>
                    <Icon name="chevron-forward" size={18} color="textSecondary" />
                  </View>
                </Pressable>
              );
            })}
          </Card>

          <SectionHeader title={`На що йдуть витрати · ${p.label}`} />
          <Card>
            <CategoryBreakdown items={data.categories} />
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
  place: { width: 18, textAlign: 'center' },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
