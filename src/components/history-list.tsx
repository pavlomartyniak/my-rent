import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import type { HistoryPage } from '@/lib/reports';

import { ReportStatus } from './report-status';
import { ThemedText } from './themed-text';
import { TransactionRow } from './transaction-row';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { EmptyState } from './ui/empty-state';

const FIRST_MONTHS = 2;
const STEP = 3;

/**
 * Історія записів авто по місяцях. Сервер віддає її частинами (спершу два найновіші місяці)
 * разом із підсумком кожного місяця, тож телефон не вантажить усі записи.
 */
export function HistoryList({ carId }: { carId: string }) {
  const theme = useTheme();
  const [months, setMonths] = useState(FIRST_MONTHS);
  const { data, loading, error, retry } = useReport<HistoryPage>(`/transactions/history?carId=${carId}&months=${months}`, { keepPrevious: true });

  if (!data) return <ReportStatus loading={loading} error={error} onRetry={retry} />;
  if (!data.groups.length) {
    return <EmptyState icon="receipt-outline" title="Записів ще немає" text="Додайте перший дохід або витрату." />;
  }

  const left = data.totalMonths - data.groups.length;

  return (
    <View style={styles.wrap}>
      {data.groups.map((g) => (
        <View key={g.month} style={styles.group}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {monthTitle(g.month)}
            </ThemedText>
            <ThemedText type="smallBold" themeColor={g.profit >= 0 ? 'positive' : 'negative'}>
              {g.profit >= 0 ? '+' : ''}
              {formatMoney(g.profit)}
            </ThemedText>
          </View>
          <Card style={styles.card}>
            {g.items.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
                <TransactionRow tx={tx} />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {data.hasMore ? (
        <Button
          title={`Показати раніші (ще ${left} ${plural(left, 'місяць', 'місяці', 'місяців')})`}
          variant="secondary"
          onPress={() => setMonths((m) => m + STEP)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  group: { gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.one },
  card: { paddingVertical: 0, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 48 + Spacing.three },
});
