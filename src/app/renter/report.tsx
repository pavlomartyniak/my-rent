import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
import { DealReportView } from '@/components/deal-report-view';
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
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle } from '@/lib/date';
import { dealStage, type DealReport, type DealView, type RenterSummary } from '@/lib/deals';
import { formatMoney, splitTitle } from '@/lib/format';

/** Звіт орендаря: скільки заробив, скільки витратив і платить власникам, прибуток по кожній оренді */
export default function RenterReportScreen() {
  const router = useRouter();
  const theme = useTheme();
  const p = usePeriod();
  const deals = useReport<DealView[]>('/deals');
  // `?dealId=` відкриває розділ із вибраною орендою (перехід із картки оренди); власний вибір діє, доки параметр той самий
  const params = useLocalSearchParams<{ dealId?: string }>();
  const [pick, setPick] = useState<{ param?: string; id: string | null }>();
  const dealId = pick && pick.param === params.dealId ? pick.id : (params.dealId ?? null);
  const deal = deals.data?.find((d) => d.id === dealId);
  const { data, loading, error, retry } = useReport<RenterSummary>(deal ? null : `/reports/renter/summary?period=${p.key}`);
  const dealReport = useReport<DealReport>(deal ? `/reports/renter/deals/${deal.id}?period=${p.key}` : null);

  // Запис орендаря прив'язаний до оренди: вибрану відкриваємо одразу, одну чинну теж, з кількох просимо обрати
  const addRecord = () => {
    const open = (id: string) => router.push({ pathname: '/transaction/new', params: { dealId: id } });
    if (deal) return open(deal.id);
    const current = (deals.data ?? []).filter((d) => dealStage(d) !== 'finished' && dealStage(d) !== 'terminated');
    if (current.length === 1) return open(current[0].id);
    Alert.alert('До якої оренди запис?', undefined, [...current.map((d) => ({ text: splitTitle(d.title).name, onPress: () => open(d.id) })), { text: 'Скасувати', style: 'cancel' as const }]);
  };

  const monthly = p.key.length === 7;
  const ranking = (data?.deals ?? [])
    .flatMap((row) => {
      const deal = deals.data?.find((d) => d.id === row.dealId);
      return deal ? [{ deal, period: row.period }] : [];
    })
    .sort((a, b) => b.period.profit - a.period.profit);

  // Пояснення під сумою, коли доходу немає, а витрати є (зазвичай це оплата оренди)
  const noIncomeNote =
    data && data.totals.income === 0 && data.totals.expense > 0 ? `Доходу ${p.all ? 'за весь час' : monthly ? 'цього місяця' : 'цього року'} ще немає — лише витрати на оренду` : undefined;

  return (
    <Screen tabs>
      <ScreenTitle actions={<ExportIconButton filter={{ period: p.key, ...(deal ? { dealId: deal.id } : {}) }} subtitle={`${deal ? splitTitle(deal.title).name : 'Усі оренди'} · ${p.label}`} />}>Доходи</ScreenTitle>

      {(deals.data?.length ?? 0) > 1 ? (
        <ScopeFilter
          label="Оренда"
          allLabel="Усі оренди"
          options={(deals.data ?? []).map((d) => ({ id: d.id, label: splitTitle(d.title).name }))}
          value={deal?.id ?? null}
          onChange={(id) => setPick({ param: params.dealId, id })}
        />
      ) : null}

      <PeriodSwitcher state={p} />

      {deal ? (
        dealReport.data ? (
          <>
            <Button title="Додати дохід або витрату" icon="add" onPress={addRecord} />
            <DealReportView id={deal.id} data={dealReport.data} p={p} />
          </>
        ) : (
          <ReportStatus loading={dealReport.loading} error={dealReport.error} onRetry={dealReport.retry} />
        )
      ) : !data ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : data.deals.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Поки що нічого рахувати" text="Звіт з’явиться, коли у вас буде оренда й перші записи." />
      ) : (
        <>
          <SummaryCard
            title={`Прибуток · ${p.label}`}
            profit={data.totals.profit}
            income={data.totals.income}
            expense={data.totals.expense}
            change={data.previousPeriod ? data.change.profit : undefined}
            margin={data.totals.margin}
            caption={noIncomeNote}
            scope={{ period: p.key, label: p.label }}>
            <View style={styles.export}>
              <ExportButton filter={{ period: p.key }} subtitle={`Усі оренди · ${p.label}`} title={`Експорт за ${p.label}`} />
            </View>
          </SummaryCard>

          {data.previousPeriod ? (
            <ComparisonCard
              title={monthly ? 'Порівняно з минулим місяцем' : 'Порівняно з минулим роком'}
              previousLabel={monthly ? monthTitle(data.previousPeriod) : data.previousPeriod}
              report={data}
            />
          ) : null}

          <BarChart key={p.key} data={data.series} card carFirst />

          <Card style={styles.paid}>
            <View style={[styles.paidIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="key-outline" size={22} color="accent" />
            </View>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Сплачено власникам за весь час
              </ThemedText>
              <ThemedText style={styles.paidValue}>{formatMoney(data.rentPaidTotal)}</ThemedText>
            </View>
          </Card>

          <Button title="Додати дохід або витрату" icon="add" onPress={addRecord} />

          <SectionHeader title="Прибуток по орендах" />
          <Card style={styles.list}>
            {ranking.map(({ deal, period }, i) => (
              <Pressable key={deal.id} accessibilityRole="button" onPress={() => setPick({ param: params.dealId, id: deal.id })}>
                <View style={[styles.row, i > 0 && styles.rowBorder]}>
                  <CarPhoto uri={deal.photoUri} style={styles.thumb} iconSize={22} />
                  <View style={styles.flex}>
                    <View style={styles.top}>
                      <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                        {deal.title}
                      </ThemedText>
                      <ThemedText type="default" style={styles.value} themeColor={period.profit >= 0 ? 'positive' : 'negative'}>
                        {formatMoney(period.profit)}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      Дохід{' '}
                      <ThemedText type="smallBold" themeColor="positive">
                        {formatMoney(period.income)}
                      </ThemedText>
                      {'  ·  '}Витрати{' '}
                      <ThemedText type="smallBold" themeColor="negative">
                        {formatMoney(period.expense)}
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <Icon name="chevron-forward" size={18} color="textSecondary" />
                </View>
              </Pressable>
            ))}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)' },
  thumb: { width: 52, height: 52, borderRadius: Radius.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  value: { fontWeight: 600, textAlign: 'right', flexShrink: 0 },
  export: { marginTop: Spacing.two },
  paid: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  paidIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  paidValue: { ...Type.figure },
});
