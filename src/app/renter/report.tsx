import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CarPhoto } from '@/components/car-photo';
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
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle } from '@/lib/date';
import type { DealView, RenterSummary } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

/** Звіт орендаря: скільки заробив, скільки витратив і платить власникам, прибуток по кожній оренді */
export default function RenterReportScreen() {
  const router = useRouter();
  const theme = useTheme();
  const p = usePeriod();
  const { data, loading, error, retry } = useReport<RenterSummary>(`/reports/renter/summary?period=${p.key}`);
  const deals = useReport<DealView[]>('/deals');

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
      <ScreenTitle actions={<ExportIconButton filter={{ period: p.key }} subtitle={`Усі оренди · ${p.label}`} />}>Звіт</ScreenTitle>

      <PeriodSwitcher state={p} />

      {!data ? (
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
            caption={noIncomeNote}>
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

          <SectionHeader title="Прибуток по орендах" />
          <Card style={styles.list}>
            {ranking.map(({ deal, period }, i) => (
              <Pressable key={deal.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/deals/[id]', params: { id: deal.id } })}>
                <View style={[styles.row, i > 0 && styles.rowBorder]}>
                  <CarPhoto uri={deal.photoUri} style={styles.thumb} iconSize={22} />
                  <View style={styles.flex}>
                    <View style={styles.top}>
                      <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                        {deal.title}
                      </ThemedText>
                      <ThemedText type="default" style={styles.bold} themeColor={period.profit >= 0 ? 'positive' : 'negative'}>
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
  bold: { fontWeight: 700 },
  export: { marginTop: Spacing.two },
  paid: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  paidIcon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  paidValue: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
});
