import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openChat } from '@/lib/chat';
import { daysUntil, formatDate, rentalProgress } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';

import { ContractCard } from './contract-card';
import { TerminateDeal } from './terminate-deal';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { IconButton } from './ui/icon-button';

/** Ініціали для аватара: перші літери двох перших слів */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Оренда авто на сторінці власника: орендар з аватаром і кнопкою чату, дати з прогресом і днями, що лишились,
 * стан договору та пропозиція розірвати оренду.
 */
export function OwnerRentalCard({ deal }: { deal: DealView }) {
  const theme = useTheme();
  const awaiting = deal.status === 'awaiting';
  const active = dealStage(deal) === 'active';
  const left = active ? Math.max(0, daysUntil(deal.endDate)) : null;

  return (
    <Card style={styles.card}>
      <ThemedText type="default" style={styles.title}>
        {awaiting ? 'Домовленість: чекаємо підписання договору' : 'Зараз в оренді'}
      </ThemedText>

      <View style={styles.person}>
        <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" themeColor="accent">
            {initials(deal.counterpart.name)}
          </ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold} numberOfLines={1}>
            {deal.counterpart.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatMoney(deal.pricePerDay)} за добу
          </ThemedText>
        </View>
        <IconButton icon="chatbubble-ellipses-outline" label="Написати" onPress={() => void openChat({ dealId: deal.id })} />
      </View>

      <View style={[styles.panel, { backgroundColor: theme.backgroundSelected }]}>
        <View style={styles.between}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
          </ThemedText>
          {left !== null ? (
            <ThemedText type="smallBold" themeColor="accent">
              ще {left} {plural(left, 'доба', 'доби', 'діб')}
            </ThemedText>
          ) : null}
        </View>
        {active ? (
          <View style={[styles.track, { backgroundColor: theme.borderStrong }]}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.round(rentalProgress(deal.startDate, deal.endDate) * 100)}%` }]} />
          </View>
        ) : null}
      </View>

      <ContractCard deal={deal} as="owner" />
      {awaiting ? null : <TerminateDeal deal={deal} as="owner" />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  title: { fontWeight: 700, fontSize: 18 },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  panel: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
