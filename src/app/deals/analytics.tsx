import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { PeriodSwitcher, usePeriod } from '@/components/period-switcher';
import { ReportStatus } from '@/components/report-status';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import type { DealReport, DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

/** Аналітика однієї оренди: період, графік, на що йдуть витрати, підсумок за весь час */
export default function DealAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePeriod();
  const deal = useReport<DealView>(`/deals/${id}`);
  const { data, loading, error, retry } = useReport<DealReport>(`/reports/renter/deals/${id}?period=${p.key}`);
  const o = data?.overview;

  return (
    <Screen>
      <Stack.Screen options={{ title: deal.data?.title ?? 'Аналітика' }} />

      <PeriodSwitcher state={p} />

      {!data || !o ? (
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      ) : (
        <>
          <SummaryCard title={`Прибуток · ${p.label}`} profit={data.totals.profit} income={data.totals.income} expense={data.totals.expense} />

          <Card>
            <BarChart key={p.key} data={data.series} scope={{ dealId: id }} />
          </Card>

          <SectionHeader title={`На що йдуть витрати · ${p.label}`} />
          <Card>
            <CategoryBreakdown items={data.categories} />
          </Card>

          <SectionHeader title="За весь час оренди" />
          <SummaryCard title="Прибуток" profit={o.profit} income={o.income} expense={o.expense} />
          <View style={styles.grid}>
            <Stat label="Сплачено власнику" value={formatMoney(o.rentPaid)} />
            <Stat label="Інші витрати" value={formatMoney(o.otherExpenses)} />
          </View>
          <View style={styles.grid}>
            <Stat label="Прибуток на добу" value={formatMoney(o.avgProfitPerDay)} color={o.avgProfitPerDay >= 0 ? 'positive' : 'negative'} />
            <Stat label="Баланс платежів" value={o.rentBalance === 0 ? 'Все сплачено' : `${o.rentBalance > 0 ? 'Борг' : 'Переплата'} ${formatMoney(Math.abs(o.rentBalance))}`} color={o.rentBalance > 0 ? 'negative' : 'positive'} />
          </View>

          <SectionHeader title="Витрати за весь час" />
          <Card>
            <CategoryBreakdown items={data.allCategories} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'positive' | 'negative' }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default" style={styles.statValue} themeColor={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: Spacing.one },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
});
