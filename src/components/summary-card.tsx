import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Card } from './ui/card';

type Props = { title: string; profit: number; income: number; expense: number; note?: string };

/** Головне число екрана: прибуток, а під ним доходи й витрати двома плашками */
export function SummaryCard({ title, profit, income, expense, note }: Props) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText style={styles.value} themeColor={profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(profit)}
      </ThemedText>
      <View style={styles.row}>
        <View style={[styles.chip, { backgroundColor: theme.positiveSoft }]}>
          <ThemedText type="small" themeColor="positive">
            Дохід
          </ThemedText>
          <ThemedText type="smallBold" themeColor="positive">
            {formatMoney(income)}
          </ThemedText>
        </View>
        <View style={[styles.chip, { backgroundColor: theme.negativeSoft }]}>
          <ThemedText type="small" themeColor="negative">
            Витрати
          </ThemedText>
          <ThemedText type="smallBold" themeColor="negative">
            {formatMoney(expense)}
          </ThemedText>
        </View>
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
  card: { gap: Spacing.one, paddingVertical: Spacing.four, paddingHorizontal: Spacing.four },
  value: { fontSize: 44, lineHeight: 52, fontWeight: 700, letterSpacing: -1 },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  chip: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
});
