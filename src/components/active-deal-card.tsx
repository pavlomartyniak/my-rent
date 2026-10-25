import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { contactActions } from '@/lib/contact-actions';
import { dealStage, type DealOverview, type DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';
import type { Totals } from '@/lib/reports';

import { CarPhoto } from './car-photo';
import { ContractCard } from './contract-card';
import { ContactChips } from './contact-chips';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';

type Props = {
  deal: DealView;
  /** Підсумки за поточний місяць і за весь час; без них показуємо лише умови */
  month?: Totals;
  overview?: DealOverview;
};

/**
 * Авто, яке я зараз орендую: скільки діб минуло, прибуток за місяць, баланс платежів власнику
 * і швидкі дії (записати заробіток чи витрату, написати власнику).
 */
export function ActiveDealCard({ deal, month, overview }: Props) {
  const router = useRouter();
  const stage = dealStage(deal);
  const left = overview ? Math.max(0, overview.totalDays - overview.elapsedDays) : undefined;
  const add = (type: 'income' | 'expense') => router.push({ pathname: '/transaction/new', params: { dealId: deal.id, type } });

  const balance = overview?.rentBalance ?? 0;
  const balanceText = !overview ? '—' : balance > 0 ? `Борг ${formatMoney(balance)}` : balance < 0 ? `Переплата ${formatMoney(-balance)}` : 'Все сплачено';

  return (
    <Card>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button" style={styles.top}>
          <CarPhoto uri={deal.photoUri} style={styles.thumb} iconSize={26} />
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.bold} numberOfLines={1}>
              {deal.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
            </ThemedText>
            {stage === 'active' && left !== undefined ? (
              <ThemedText type="smallBold" themeColor="accent">
                Залишилось {left} {plural(left, 'доба', 'доби', 'діб')}
              </ThemedText>
            ) : null}
          </View>
          <StatusBadge status={stage} />
        </Pressable>
      </Link>

      {stage === 'signing' ? (
        <>
          <ContractCard deal={deal} as="renter" />
          <ContactChips actions={contactActions({ chat: { dealId: deal.id }, phone: deal.counterpart.phone })} />
        </>
      ) : (
        <>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <ThemedText type="small" themeColor="textSecondary">
            Прибуток за місяць
          </ThemedText>
          <ThemedText type="default" style={styles.bold} themeColor={!month || month.profit >= 0 ? 'positive' : 'negative'}>
            {formatMoney(month?.profit ?? 0)}
          </ThemedText>
        </View>
        <View style={styles.stat}>
          <ThemedText type="small" themeColor="textSecondary">
            Платежі власнику
          </ThemedText>
          <ThemedText type="default" style={styles.bold} themeColor={balance > 0 ? 'negative' : 'positive'} numberOfLines={1} adjustsFontSizeToFit>
            {balanceText}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Заробіток" icon="add-circle-outline" variant="positive" style={styles.flex} onPress={() => add('income')} />
        <Button title="Витрата" icon="remove-circle-outline" variant="secondary" style={styles.flex} onPress={() => add('expense')} />
      </View>
          <ContactChips actions={contactActions({ chat: { dealId: deal.id }, phone: deal.counterpart.phone })} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: Radius.md },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  stats: { flexDirection: 'row', gap: Spacing.three },
  stat: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
