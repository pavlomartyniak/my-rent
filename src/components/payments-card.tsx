import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';

/**
 * Платежі за договором: графік, що підтвердила кожна сторона, розбіжності й розрахунок після розірвання.
 * Облік створюється саме за цими підтвердженнями.
 */
export function PaymentsCard({ deal, as }: { deal: Pick<DealView, 'id' | 'status' | 'paymentPlan' | 'payments' | 'settlement' | 'contract'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  if (!deal.contract || deal.payments.length === 0) return null;

  const mineVerb = as === 'renter' ? 'сплатили' : 'отримали';
  const otherVerb = as === 'renter' ? 'отримав' : 'сплатив';
  const otherName = as === 'renter' ? 'Власник' : 'Орендар';
  const signed = deal.status !== 'awaiting';
  const payments = deal.payments.filter((p) => !p.cancelled);
  const open = (n: number) => router.push({ pathname: '/payments/[id]', params: { id: deal.id, n: String(n) } });

  return (
    <Card>
      <ThemedText type="default" style={styles.bold}>
        Платежі за договором · {deal.paymentPlan === 'monthly' ? 'щомісяця' : 'вся сума одразу'}
      </ThemedText>
      {!signed ? (
        <ThemedText type="small" themeColor="textSecondary">
          Підтверджувати платежі можна після підписання договору.
        </ThemedText>
      ) : null}

      {payments.map((p) => (
        <View key={p.n} style={[styles.row, { borderTopColor: theme.border }]}>
          <View style={styles.head}>
            <ThemedText type="smallBold">
              {deal.payments.length > 1 ? `Платіж ${p.n}` : 'Оплата'} · {formatDate(p.dueDate)}
            </ThemedText>
            <ThemedText type="smallBold">{formatMoney(p.amount)}</ThemedText>
          </View>
          <ThemedText type="small" themeColor={p.mine >= p.amount ? 'positive' : 'textSecondary'}>
            {p.mine > 0 ? `Ви ${mineVerb}: ${formatMoney(p.mine)}${p.mine < p.amount ? ` з ${formatMoney(p.amount)}` : ''}` : `Ви ще не підтвердили`}
          </ThemedText>
          <ThemedText type="small" themeColor={p.other >= p.amount ? 'positive' : 'textSecondary'}>
            {p.other > 0 ? `${otherName} ${otherVerb}: ${formatMoney(p.other)}` : `${otherName} ще не підтвердив`}
          </ThemedText>
          {p.mismatch ? (
            <View style={[styles.warn, { backgroundColor: theme.warningSoft }]}>
              <ThemedText type="smallBold" themeColor="warning">
                Суми не збігаються: {formatMoney(p.mine)} і {formatMoney(p.other)}. Уточніть у чаті
              </ThemedText>
            </View>
          ) : null}
          {signed && deal.status === 'active' && p.available && p.remaining > 0 ? (
            <Button title={p.mine > 0 ? 'Оновити суму' : 'Підтвердити платіж'} icon="cash-outline" variant={p.mine > 0 ? 'secondary' : 'primary'} onPress={() => open(p.n)} />
          ) : null}
          {signed && deal.status === 'active' && !p.available ? (
            <ThemedText type="small" themeColor="textSecondary">
              Підтвердження відкриється {formatDate(p.dueDate)}
            </ThemedText>
          ) : null}
        </View>
      ))}

      {deal.settlement ? (
        <View style={[styles.warn, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">Розрахунок після розірвання</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            За використані доби належить {formatMoney(deal.settlement.due)}. Орендар підтвердив {formatMoney(deal.settlement.paid)}, власник {formatMoney(deal.settlement.received)}.
            {Math.abs(deal.settlement.paid - deal.settlement.due) > 0.5 ? ' Різницю закрийте повернення чи доплатою й запишіть її в облік вручну.' : ''}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  row: { gap: Spacing.one, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  warn: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.one },
});
