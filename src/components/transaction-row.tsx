import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoryIcon } from '@/lib/category-icon';
import { dayMonth, weekdayShort } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types';

import { ThemedText } from './themed-text';

/** Рядок історії: іконка категорії в колі (зелене для доходу, червоне для витрати), категорія, підпис з датою, сума */
export function TransactionRow({ tx, car }: { tx: Transaction; /** Назва авто: показується, коли список охоплює кілька авто */ car?: string }) {
  const theme = useTheme();
  const income = tx.type === 'income';
  const tone = income ? 'positive' : 'negative';
  // Дата йде в підпис: рядок не залежить від групування, тож день видно і в історії, і під графіком
  const details = [`${dayMonth(tx.date)}, ${weekdayShort(tx.date)}`, car, tx.driver, tx.note].filter(Boolean).join(' · ');

  return (
    <Link href={{ pathname: '/transaction/[id]', params: { id: tx.id } }} asChild>
      {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
      <Pressable accessibilityRole="button">
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: income ? theme.positiveSoft : theme.negativeSoft }]}>
            <ThemedText style={styles.emoji}>{categoryIcon(tx.category, income)}</ThemedText>
          </View>

          <View style={styles.flex}>
            <ThemedText type="default" style={styles.title}>
              {tx.category}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {details}
            </ThemedText>
          </View>

          <ThemedText type="default" style={styles.amount} themeColor={tone}>
            {income ? '+' : '−'}
            {formatMoney(tx.amount)}
          </ThemedText>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  icon: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  flex: { flex: 1 },
  title: { fontWeight: 600 },
  amount: { fontWeight: 700 },
});
