import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalyticsHeader } from '@/components/analytics-header';
import { BarChart } from '@/components/bar-chart';
import { CategoryPanel } from '@/components/category-panel';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SplitBar } from '@/components/split-bar';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { DealReport, DealView } from '@/lib/deals';
import { formatMoney, splitTitle } from '@/lib/format';

/** Аналітика однієї оренди: період, графік, на що йдуть витрати, підсумок за весь час */
export default function DealAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const p = usePeriod();
  const deal = useReport<DealView>(`/deals/${id}`);
  const { data, loading, error, retry } = useReport<DealReport>(`/reports/renter/deals/${id}?period=${p.key}`);
  const o = data?.overview;
  const balance = o?.rentBalance ?? 0;
  const share = o && o.income > 0 ? (o.expense / o.income) * 100 : null;

  return (
    // Свій заголовок із фото авто замість системного хедера: відступ під статус-бар задаємо вручну
    <Screen contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: insets.top + Spacing.two }}>
      <Stack.Screen options={{ headerShown: false }} />

      <AnalyticsHeader photoUri={deal.data?.photoUri} title={deal.data ? splitTitle(deal.data.title).name : 'Оренда'} subtitle="Аналітика водія" />

      <PeriodSwitcher state={p} />

      {!data || !o ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <SummaryCard title={`Прибуток · ${p.label}`} profit={data.totals.profit} income={data.totals.income} expense={data.totals.expense} />

          <Card>
            <BarChart key={p.key} data={data.series} scope={{ dealId: id }} titled />
          </Card>

          <Card>
            <CategoryPanel dealId={id} title="На що йдуть витрати" />
          </Card>

          <SectionHeader title="За весь час оренди" />
          <SummaryCard title="Прибуток" profit={o.profit} income={o.income} expense={o.expense}>
            {share !== null ? (
              <View style={styles.share}>
                <SplitBar income={o.income} expense={o.expense} />
                <ThemedText type="small" themeColor="textSecondary">
                  Витрати складають{' '}
                  <ThemedText type="smallBold" themeColor="negative">
                    {Math.round(share)}%
                  </ThemedText>{' '}
                  від доходів
                </ThemedText>
              </View>
            ) : null}
          </SummaryCard>
          <View style={styles.grid}>
            <Stat label="Сплачено власнику" value={formatMoney(o.rentPaid)} />
            <Stat label="Інші витрати" value={formatMoney(o.otherExpenses)} color="negative" />
          </View>
          <View style={styles.grid}>
            <Stat label="Прибуток на добу" value={formatMoney(o.avgProfitPerDay)} color={o.avgProfitPerDay >= 0 ? 'positive' : 'negative'} />
            <Stat
              label="Баланс платежів"
              value={balance === 0 ? 'Все сплачено' : formatMoney(Math.abs(balance))}
              note={balance === 0 ? undefined : balance > 0 ? 'Борг' : 'Переплата'}
              color={balance > 0 ? 'negative' : 'positive'}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, note, color }: { label: string; value: string; note?: string; color?: 'positive' | 'negative' }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.statValue} themeColor={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {note ? (
        <ThemedText type="smallBold" themeColor={color}>
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  share: { gap: Spacing.two, marginTop: Spacing.two },
  grid: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
});
