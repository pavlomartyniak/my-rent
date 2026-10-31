import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';
import { planLabel } from '@/lib/payment-plan';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/**
 * Платежі за договором: графік, що підтвердила кожна сторона, розбіжності й розрахунок після розірвання.
 * Облік створюється саме за цими підтвердженнями.
 */
function Check({ done, text }: { done: boolean; text: string }) {
  return (
    <View style={styles.check}>
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? 'positive' : 'textSecondary'} />
      <ThemedText type="small" themeColor={done ? 'positive' : 'textSecondary'} style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

export function PaymentsCard({ deal, as }: { deal: Pick<DealView, 'id' | 'status' | 'paymentPlan' | 'payments' | 'deposit' | 'settlement' | 'contract'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  if (!deal.contract || deal.payments.length === 0) return null;

  const mineVerb = as === 'renter' ? 'сплатили' : 'отримали';
  const otherVerb = as === 'renter' ? 'отримав' : 'сплатив';
  const otherName = as === 'renter' ? 'Власник' : 'Орендар';
  const signed = deal.status !== 'awaiting';
  const payments = deal.payments.filter((p) => !p.cancelled);
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const paid = payments.reduce((sum, p) => sum + Math.min(p.mine, p.amount), 0);
  // Щотижнева чи щоденна оплата дає десятки платежів: поза розгорнутим списком лишаємо поточний, сусідні й проблемні
  const done = (p: (typeof payments)[number]) => p.mine >= p.amount && p.other >= p.amount;
  const cur = Math.max(0, payments.findIndex((p) => !done(p)));
  const collapsed = !expanded && payments.length > 6;
  const shown = collapsed ? payments.filter((p, i) => p.mismatch || (i >= cur - 1 && i <= cur + 2)) : payments;
  const open = (n: number) => router.push({ pathname: '/payments/[id]', params: { id: deal.id, n: String(n) } });

  const dep = deal.deposit;

  return (
    <Card>
      <ThemedText type="default" style={styles.bold}>
        Платежі за договором · {planLabel(deal.paymentPlan)}
      </ThemedText>
      {!signed ? (
        <ThemedText type="small" themeColor="textSecondary">
          Підтверджувати платежі можна після підписання договору.
        </ThemedText>
      ) : null}

      {dep ? (
        <View style={[styles.row, { borderTopColor: theme.border }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">Застава</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Разом із першою оплатою. Не входить в оренду й не потрапляє в облік: повернення домовляєтесь самі
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.amount}>
              {formatMoney(dep.amount)}
            </ThemedText>
          </View>
          <Check done={dep.mine} text={dep.mine ? `Ви ${as === 'renter' ? 'внесли' : 'отримали'} заставу` : 'Ви ще не підтвердили'} />
          <Check done={dep.other} text={dep.other ? `${otherName} ${as === 'renter' ? 'отримав' : 'вніс'} заставу` : `${otherName} ще не підтвердив`} />
          {dep.available && !dep.mine ? <Button title={as === 'renter' ? 'Я вніс заставу' : 'Я отримав заставу'} icon="shield-checkmark-outline" onPress={() => router.push({ pathname: '/deposit/[id]', params: { id: deal.id } })} /> : null}
          {!dep.available && !dep.mine ? (
            <ThemedText type="small" themeColor="textSecondary">
              Підтвердження відкриється після підписання договору.
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {payments.length > 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Ви {mineVerb} {formatMoney(paid)} з {formatMoney(total)}
        </ThemedText>
      ) : null}

      {shown.map((p) => (
        <View key={p.n} style={[styles.row, { borderTopColor: theme.border }]}>
          <View style={styles.head}>
            <View>
              <ThemedText type="smallBold">{deal.payments.length > 1 ? `Платіж ${p.n}` : 'Оплата'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDate(p.dueDate)}
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.amount}>
              {formatMoney(p.amount)}
            </ThemedText>
          </View>
          <Check done={p.mine >= p.amount} text={p.mine > 0 ? `Ви ${mineVerb}: ${formatMoney(p.mine)}${p.mine < p.amount ? ` з ${formatMoney(p.amount)}` : ''}` : 'Ви ще не підтвердили'} />
          <Check done={p.other >= p.amount} text={p.other > 0 ? `${otherName} ${otherVerb}: ${formatMoney(p.other)}` : `${otherName} ще не підтвердив`} />
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

      {payments.length > 6 ? <Button title={collapsed ? `Показати всі платежі (${payments.length})` : 'Згорнути'} variant="secondary" onPress={() => setExpanded((v) => !v)} /> : null}

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
  bold: { fontWeight: 600, fontSize: 18 },
  amount: { fontWeight: 700 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: { gap: Spacing.two, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  warn: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.one },
});
