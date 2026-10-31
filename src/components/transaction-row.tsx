import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShort } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Рядок історії: дата-плашка (зелена для доходу, червона для витрати), назва, сума */
export function TransactionRow({ tx, car }: { tx: Transaction; /** Назва авто: показується, коли список охоплює кілька авто */ car?: string }) {
  const theme = useTheme();
  const income = tx.type === 'income';
  const tone = income ? 'positive' : 'negative';
  const details = [car, tx.driver, tx.note].filter(Boolean).join(' · ');

  return (
    <Link href={{ pathname: '/transaction/[id]', params: { id: tx.id } }} asChild>
      {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
      <Pressable accessibilityRole="button">
        <View style={styles.row}>
          <View style={[styles.date, { backgroundColor: income ? theme.positiveSoft : theme.negativeSoft }]}>
            <ThemedText style={styles.day} themeColor={tone}>
              {Number(tx.date.slice(8, 10))}
            </ThemedText>
            <ThemedText type="small" style={styles.weekday} themeColor={tone}>
              {weekdayShort(tx.date)}
            </ThemedText>
          </View>

          <View style={styles.flex}>
            <ThemedText type="default" style={styles.title}>
              {tx.category}
            </ThemedText>
            {details ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {details}
              </ThemedText>
            ) : null}
          </View>

          <ThemedText type="default" style={styles.amount} themeColor={tone}>
            {income ? '+' : '−'}
            {formatMoney(tx.amount)}
          </ThemedText>
          <Icon name="chevron-forward" size={18} color="textSecondary" />
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  date: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 18, lineHeight: 20, fontWeight: 700 },
  weekday: { fontSize: 12, lineHeight: 14, fontWeight: 600 },
  flex: { flex: 1 },
  title: { fontWeight: 600 },
  amount: { fontWeight: 700 },
});
