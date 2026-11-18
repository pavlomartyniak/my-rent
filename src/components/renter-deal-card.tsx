import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openChat } from '@/lib/chat';
import { openProfile } from '@/lib/profiles';
import { daysUntil, formatDate } from '@/lib/date';
import { dealStage, type DealOverview, type DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';

import { ContractCard } from './contract-card';
import { TerminateDeal } from './terminate-deal';
import { Avatar } from './avatar';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { IconButton } from './ui/icon-button';

/**
 * Оренда на сторінці орендаря: власник з аватаром і кнопкою чату, скільки діб лишилось з ціною за добу й прогресом,
 * стан договору та пропозиція розірвати оренду.
 */
export function RenterDealCard({ deal, overview }: { deal: DealView; overview?: DealOverview }) {
  const theme = useTheme();
  const stage = dealStage(deal);
  const left = overview ? Math.max(0, overview.totalDays - overview.elapsedDays) : undefined;
  const progress = overview && overview.totalDays > 0 ? Math.min(1, overview.elapsedDays / overview.totalDays) : 0;
  const days = stage === 'upcoming' ? daysUntil(deal.startDate) : left;

  return (
    <Card style={styles.card}>
      <ThemedText type="default" style={styles.title}>
        Оренда
      </ThemedText>

      <View style={styles.person}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Власник ${deal.counterpart.name}. Відкрити профіль`} onPress={() => openProfile(deal.counterpart.id)} style={[styles.person, styles.flex]}>
          <Avatar uri={deal.counterpart.photoUri} name={deal.counterpart.name} size={44} />
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Власник
            </ThemedText>
            <ThemedText type="default" style={styles.bold} numberOfLines={1}>
              {deal.counterpart.name}
            </ThemedText>
          </View>
        </Pressable>
        <IconButton icon="chatbubble-ellipses-outline" label="Написати" onPress={() => void openChat({ dealId: deal.id })} />
      </View>

      <View style={[styles.panel, { backgroundColor: theme.accentSoft }]}>
        <View style={styles.between}>
          <View>
            <ThemedText type="smallBold" themeColor="accent">
              {stage === 'upcoming' ? 'Починається через' : stage === 'active' ? 'Залишилось' : 'Оренда'}
            </ThemedText>
            <ThemedText style={styles.big} themeColor="accent">
              {stage === 'upcoming' || stage === 'active'
                ? days !== undefined
                  ? `${days} ${plural(days, 'доба', 'доби', 'діб')}`
                  : '—'
                : `${overview?.totalDays ?? ''} ${plural(overview?.totalDays ?? 0, 'доба', 'доби', 'діб')}`.trim()}
            </ThemedText>
          </View>
          <View style={styles.price}>
            <ThemedText type="headline">{formatMoney(deal.pricePerDay)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              за добу
            </ThemedText>
          </View>
        </View>
        {stage === 'active' && overview ? (
          <>
            <View style={[styles.track, { backgroundColor: `${theme.accent}33` }]}>
              <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(2, Math.round(progress * 100))}%` }]} />
            </View>
          </>
        ) : null}
        <View style={styles.footnote}>
          <ThemedText type="callout" themeColor="textSecondary">
            {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
          </ThemedText>
          {stage === 'active' && overview ? (
            <ThemedText type="callout" themeColor="textSecondary">
              Минуло {overview.elapsedDays} з {overview.totalDays} діб
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ContractCard deal={deal} as="renter" />

      {stage === 'terminated' ? (
        <ThemedText type="small" themeColor="negative">
          Оренду розірвано достроково за згодою сторін (ініціатор: {deal.terminatedBy === 'owner' ? 'власник' : 'ви'})
          {deal.terminatedAt ? ` ${formatDate(deal.terminatedAt.slice(0, 10))}` : ''}. Розрахунок з власником лишається за вами: сплачені суми видно нижче.
        </ThemedText>
      ) : null}
      {stage === 'upcoming' || stage === 'active' ? <TerminateDeal deal={deal} as="renter" /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  title: { ...Type.headline },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  panel: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  between: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  big: { ...Type.figure },
  price: { alignItems: 'flex-end', flexShrink: 0 },
  footnote: { gap: 2 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
