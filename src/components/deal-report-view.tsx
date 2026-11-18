import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { CategoryPanel } from '@/components/category-panel';
import { SplitBar } from '@/components/split-bar';
import { SummaryCard } from '@/components/summary-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing, Type } from '@/constants/theme';
import type { DealReport } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

/** Звіт однієї оренди: частина розділу «Доходи» (фільтр «Оренда»), а не окремий екран */
export function DealReportView({ id, data, p }: { id: string; data: DealReport; p: { key: string; label: string } }) {
  const o = data.overview;
  const balance = o.rentBalance ?? 0;
  const share = o.income > 0 ? (o.expense / o.income) * 100 : null;
  return (
        <>
          <SummaryCard title={`Прибуток · ${p.label}`} profit={data.totals.profit} income={data.totals.income} expense={data.totals.expense} scope={{ period: p.key, label: p.label, dealId: id }} />

          <Card>
            <BarChart key={p.key} data={data.series} scope={{ dealId: id }} titled />
          </Card>

          <Card>
            <CategoryPanel dealId={id} title="На що йдуть витрати" />
          </Card>

          <SectionHeader title="За весь час оренди" />
          <SummaryCard title="Прибуток" profit={o.profit} income={o.income} expense={o.expense} scope={{ period: 'all', label: 'За весь час', dealId: id }}>
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
  statValue: { ...Type.headline },
});
