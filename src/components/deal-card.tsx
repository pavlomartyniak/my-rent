import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { dealStage, type DealOverview, type DealView } from '@/lib/deals';
import { formatMoney } from '@/lib/format';

import { CarPhoto } from './car-photo';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/** Картка оренди в списку: авто, дати, статус і прибуток орендаря за весь час */
export function DealCard({ deal, overview }: { deal: DealView; overview?: DealOverview }) {
  return (
    <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
      <Pressable accessibilityRole="button">
        <Card>
          <View style={styles.head}>
            <CarPhoto uri={deal.photoUri} style={styles.thumb} iconSize={22} />
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                {deal.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
              </ThemedText>
            </View>
            <StatusBadge status={dealStage(deal)} />
          </View>

          <View style={styles.foot}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Прибуток за весь час
              </ThemedText>
              <ThemedText type="default" style={styles.bold} themeColor={!overview || overview.profit >= 0 ? 'positive' : 'negative'}>
                {formatMoney(overview?.profit ?? 0)}
              </ThemedText>
            </View>
            <Icon name="chevron-forward" size={18} color="textSecondary" />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
