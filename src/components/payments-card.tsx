import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';
import { planLabel } from '@/lib/payment-plan';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/**
 * Платежі за договором: підсумок і прогрес, наступний платіж, застава й графік. Кожна сторона підтверджує свої платежі окремо;
 * облік створюється саме за цими підтвердженнями. Розбіжності й розрахунок після розірвання показуються тут же.
 */

/** Дрібна плашка статусу сторони: зелена з галочкою, коли підтвердила, інакше сіра */
function Pill({ done, text }: { done: boolean; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: done ? theme.positiveSoft : theme.backgroundSelected }]}>
      <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={done ? 'positive' : 'textSecondary'} />
      <ThemedText type="caption" themeColor={done ? 'positive' : 'textSecondary'} numberOfLines={1} style={styles.pillText}>
        {text}
      </ThemedText>
    </View>
  );
}

/** Коло стану платежу: обидві сторони підтвердили (галочка), одна (годинник), жодна (порожнє) */
function StatusDot({ state }: { state: 'both' | 'one' | 'none' }) {
  const theme = useTheme();
  const bg = state === 'both' ? theme.positive : state === 'one' ? theme.warningSoft : theme.backgroundSelected;
  return (
    <View style={[styles.dot, { backgroundColor: bg }]}>
      <Icon name={state === 'both' ? 'checkmark' : state === 'one' ? 'time-outline' : 'ellipse-outline'} size={state === 'both' ? 18 : 16} color={state === 'both' ? theme.onInk : state === 'one' ? 'warning' : 'textSecondary'} />
    </View>
  );
}

/** Згорнутий розділ графіка («Сплачені платежі · 12»): рядок із кількістю й шевроном, тап розгортає список */
function Fold({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.fold}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}: ${count}. ${open ? 'Згорнути' : 'Розгорнути'}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.foldRow, { backgroundColor: theme.backgroundSelected }, pressed && { opacity: 0.7 }]}>
        <ThemedText type="body" style={styles.foldTitle}>
          {title}
        </ThemedText>
        <View style={[styles.count, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption" style={styles.pillText}>
            {count}
          </ThemedText>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="textSecondary" />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

export function PaymentsCard({ deal, as }: { deal: Pick<DealView, 'id' | 'status' | 'paymentPlan' | 'payments' | 'deposit' | 'settlement' | 'contract'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  const [showPaid, setShowPaid] = useState(false);
  const [showLater, setShowLater] = useState(false);
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
  // Графік поділено за важливістю: найближчі (і все, що потребує уваги) на видноті, сплачені й далекі майбутні згорнуті
  const grouped = payments.length > 6;
  const paidList = grouped ? payments.filter((p) => done(p) && !p.mismatch) : [];
  const openList = grouped ? payments.filter((p) => !done(p) || p.mismatch) : payments;
  const attention = (p: (typeof payments)[number]) => p.mismatch || p.mine > 0 || p.other > 0;
  const nearby = grouped ? openList.filter((p, i) => i < 3 || attention(p)) : openList;
  const later = grouped ? openList.filter((p) => !nearby.includes(p)) : [];
  const open = (n: number) => router.push({ pathname: '/payments/[id]', params: { id: deal.id, n: String(n) } });
  const next = signed && payments.length > 1 && payments[cur] && !done(payments[cur]) ? payments[cur] : null;
  const nextDays = next ? daysUntil(next.dueDate) : null;

  const dep = deal.deposit;

  const renderItem = (p: (typeof payments)[number]) => {
      const state = done(p) ? 'both' : p.mine >= p.amount || p.other >= p.amount || p.mine > 0 || p.other > 0 ? 'one' : 'none';
      const complete = state === 'both';
      return (
        <View key={p.n} style={[styles.item, { borderColor: theme.border }]}>
          <View style={styles.head}>
            <StatusDot state={state} />
            <View style={styles.flex}>
              <ThemedText type="body" style={styles.itemTitle}>
                {deal.payments.length > 1 ? `Платіж ${p.n}` : 'Оплата'}
              </ThemedText>
              <ThemedText type="callout" themeColor={complete ? 'positive' : 'textSecondary'}>
                {formatDate(p.dueDate)}
                {complete ? ' · підтверджено обома' : ''}
              </ThemedText>
            </View>
            <ThemedText type="body" style={styles.amount}>
              {formatMoney(p.amount)}
            </ThemedText>
          </View>
          {!complete ? (
            <View style={styles.pills}>
              <Pill done={p.mine >= p.amount} text={p.mine > 0 ? `Ви ${mineVerb}: ${formatMoney(p.mine)}${p.mine < p.amount ? ` з ${formatMoney(p.amount)}` : ''}` : 'Ви ще не підтвердили'} />
              <Pill done={p.other >= p.amount} text={p.other > 0 ? `${otherName} ${otherVerb}: ${formatMoney(p.other)}` : `${otherName} ще не підтвердив`} />
            </View>
          ) : null}
          {p.mismatch ? (
            <View style={[styles.warn, { backgroundColor: theme.warningSoft }]}>
              <ThemedText type="callout" themeColor="warning" style={styles.itemTitle}>
                Суми не збігаються: {formatMoney(p.mine)} і {formatMoney(p.other)}. Уточніть у чаті
              </ThemedText>
            </View>
          ) : null}
          {signed && deal.status === 'active' && p.available && p.remaining > 0 ? (
            <Button title={p.mine > 0 ? 'Оновити суму' : 'Підтвердити платіж'} icon="cash-outline" variant={p.mine > 0 ? 'secondary' : 'primary'} compact onPress={() => open(p.n)} />
          ) : null}
          {signed && deal.status === 'active' && !p.available ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Підтвердження відкриється {formatDate(p.dueDate)}
            </ThemedText>
          ) : null}
        </View>
      );
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <ThemedText type="headline" style={styles.flex} accessibilityRole="header">
          Платежі за договором
        </ThemedText>
        <View style={[styles.plan, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.planText}>
            {planLabel(deal.paymentPlan)}
          </ThemedText>
        </View>
      </View>
      {!signed ? (
        <ThemedText type="callout" themeColor="textSecondary">
          Підтверджувати платежі можна після підписання договору.
        </ThemedText>
      ) : null}

      {payments.length > 1 ? (
        <View style={styles.summary} accessible accessibilityLabel={`${as === 'renter' ? 'Сплачено' : 'Отримано'} ${formatMoney(paid)} з ${formatMoney(total)}. Підтверджено ${payments.filter(done).length} з ${payments.length} платежів`}>
          <ThemedText type="caption" themeColor="textSecondary">
            {as === 'renter' ? 'Сплачено' : 'Отримано'}
          </ThemedText>
          <View style={styles.sumRow}>
            <ThemedText style={styles.sumValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(paid)}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary" style={styles.sumOf}>
              з {formatMoney(total)}
            </ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.fill, { backgroundColor: theme.positive, width: `${total > 0 ? Math.max(paid > 0 ? 2 : 0, Math.round((paid / total) * 100)) : 0}%` }]} />
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Підтверджено {payments.filter(done).length} з {payments.length} платежів
          </ThemedText>
        </View>
      ) : null}

      {next ? (
        <View style={[styles.next, { backgroundColor: theme.accentSoft }]}>
          <View style={[styles.nextIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="calendar-outline" size={22} color="accent" />
          </View>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="accent" style={styles.planText}>
              Наступний платіж
            </ThemedText>
            <ThemedText type="headline">{formatMoney(next.amount)}</ThemedText>
            <ThemedText type="callout" themeColor="textSecondary">
              {formatDate(next.dueDate)}
              {nextDays !== null && nextDays >= 0 ? ` · ${nextDays === 0 ? 'сьогодні' : `через ${nextDays} ${plural(nextDays, 'день', 'дні', 'днів')}`}` : ''}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {dep ? (
        <View style={[styles.deposit, { backgroundColor: theme.backgroundSelected }]}>
          <View style={styles.head}>
            <View style={[styles.depIcon, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="shield-checkmark-outline" size={20} color="accent" />
            </View>
            <ThemedText type="headline" style={styles.flex}>
              Застава
            </ThemedText>
            <ThemedText type="headline" style={styles.amount}>
              {formatMoney(dep.amount)}
            </ThemedText>
          </View>
          <ThemedText type="callout" themeColor="textSecondary">
            Вноситься разом із першою оплатою й не входить в облік доходів. Повернення сторони домовляються самі.
          </ThemedText>
          <View style={styles.pills}>
            <Pill done={dep.mine} text={dep.mine ? `Ви ${as === 'renter' ? 'внесли' : 'отримали'}` : 'Ви ще не підтвердили'} />
            <Pill done={dep.other} text={dep.other ? `${otherName} ${as === 'renter' ? 'отримав' : 'вніс'}` : `${otherName} ще не підтвердив`} />
          </View>
          {dep.available && !dep.mine ? <Button title={as === 'renter' ? 'Я вніс заставу' : 'Я отримав заставу'} icon="shield-checkmark-outline" onPress={() => router.push({ pathname: '/deposit/[id]', params: { id: deal.id } })} /> : null}
          {!dep.available && !dep.mine ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Підтвердження відкриється після підписання договору.
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {nearby.length > 0 ? (
        <>
          {payments.length > 1 ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.listTitle}>
              {grouped ? 'НАЙБЛИЖЧІ ПЛАТЕЖІ' : 'ГРАФІК ПЛАТЕЖІВ'}
            </ThemedText>
          ) : null}
          {nearby.map(renderItem)}
        </>
      ) : null}

      {paidList.length > 0 ? (
        <Fold title="Сплачені платежі" count={paidList.length} open={showPaid} onToggle={() => setShowPaid((v) => !v)}>
          {paidList.map(renderItem)}
        </Fold>
      ) : null}

      {later.length > 0 ? (
        <Fold title="Майбутні платежі" count={later.length} open={showLater} onToggle={() => setShowLater((v) => !v)}>
          {later.map(renderItem)}
        </Fold>
      ) : null}

      {deal.settlement ? (
        <View style={[styles.warn, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="headline">Розрахунок після розірвання</ThemedText>
          <ThemedText type="callout" themeColor="textSecondary">
            За використані доби належить {formatMoney(deal.settlement.due)}. Орендар підтвердив {formatMoney(deal.settlement.paid)}, власник {formatMoney(deal.settlement.received)}.
            {Math.abs(deal.settlement.paid - deal.settlement.due) > 0.5 ? ' Різницю закрийте поверненням чи доплатою й запишіть її в облік вручну.' : ''}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  flex: { flex: 1, gap: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  plan: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill, flexShrink: 0 },
  planText: { ...Type.caption, fontWeight: 600 },
  summary: { gap: Spacing.one },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  sumValue: { ...Type.figure, flexShrink: 1 },
  sumOf: { flexShrink: 0 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: Spacing.one },
  fill: { height: 8, borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  nextIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  deposit: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  depIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  amount: { fontWeight: 700, flexShrink: 0, textAlign: 'right' },
  listTitle: { letterSpacing: 0.6, marginTop: Spacing.one },
  item: { gap: Spacing.two, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  itemTitle: { fontWeight: 600 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, maxWidth: '100%' },
  pillText: { flexShrink: 1, fontWeight: 600 },
  fold: { gap: Spacing.two },
  foldRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48, paddingHorizontal: Spacing.three, borderRadius: Radius.md },
  foldTitle: { flex: 1, fontWeight: 600 },
  count: { minWidth: 28, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  warn: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.one },
});
