import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Card } from './ui/card';

type Props = { title: string; profit: number; income: number; expense: number; note?: string };

/** Головне число екрана: прибуток, а під ним доходи й витрати */
export function SummaryCard({ title, profit, income, expense, note }: Props) {
  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText style={styles.value} themeColor={profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(profit)}
      </ThemedText>
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Дохід <ThemedText type="smallBold">{formatMoney(income)}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Витрати <ThemedText type="smallBold">{formatMoney(expense)}</ThemedText>
        </ThemedText>
      </View>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one, paddingVertical: Spacing.four },
  value: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  row: { flexDirection: 'row', gap: Spacing.four, marginTop: Spacing.one },
});
