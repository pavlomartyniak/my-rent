import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthKey, monthTitle } from '@/lib/date';
import { totals } from '@/lib/finance';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types';

import { ThemedText } from './themed-text';
import { TransactionRow } from './transaction-row';
import { Button } from './ui/button';
import { Card } from './ui/card';

const INITIAL_MONTHS = 2;

/** Історія записів, згрупована по місяцях; у заголовку місяця — його прибуток */
export function HistoryList({ txs }: { txs: Transaction[] }) {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);

  const groups: { month: string; items: Transaction[] }[] = [];
  for (const tx of [...txs].sort((a, b) => b.date.localeCompare(a.date))) {
    const month = monthKey(tx.date);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(tx);
    else groups.push({ month, items: [tx] });
  }

  const visible = showAll ? groups : groups.slice(0, INITIAL_MONTHS);
  const hidden = groups.slice(INITIAL_MONTHS).reduce((n, g) => n + g.items.length, 0);

  return (
    <View style={styles.wrap}>
      {visible.map((g) => {
        const { profit } = totals(g.items);
        return (
          <View key={g.month} style={styles.group}>
            <View style={styles.header}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {monthTitle(g.month)}
              </ThemedText>
              <ThemedText type="smallBold" themeColor={profit >= 0 ? 'positive' : 'negative'}>
                {profit >= 0 ? '+' : ''}
                {formatMoney(profit)}
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
        );
      })}

      {hidden > 0 && !showAll ? (
        <Button title={`Показати раніші записи (${hidden})`} variant="secondary" onPress={() => setShowAll(true)} />
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
