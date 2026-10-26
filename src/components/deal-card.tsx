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

/** Картка оренди в списку: авто, дати, статус і прибуток орендаря за весь час */
export function DealCard({ deal, overview }: { deal: DealView; overview?: DealOverview }) {
  return (
    <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
      <Pressable accessibilityRole="button">
        <Card style={styles.card}>
          <View style={styles.head}>
            <View>
              <CarPhoto uri={deal.photoUri} style={styles.thumb} iconSize={26} />
            </View>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <ThemedText type="default" style={[styles.bold, styles.flex]} numberOfLines={1}>
                  {deal.title}
                </ThemedText>
                <StatusBadge status={dealStage(deal)} />
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
              </ThemedText>
              <View style={styles.foot}>
                <ThemedText type="small" themeColor="textSecondary">
                  Прибуток
                </ThemedText>
                <ThemedText type="default" style={styles.bold} themeColor={!overview || overview.profit >= 0 ? 'positive' : 'negative'}>
                  {formatMoney(overview?.profit ?? 0)}
                </ThemedText>
              </View>
            </View>
          </View>

          {deal.terminationRequest && !deal.terminationRequest.mine && deal.status !== 'terminated' ? (
            <ThemedText type="smallBold" themeColor="warning">
              {deal.counterpart.name} пропонує розірвати оренду: потрібна ваша відповідь
            </ThemedText>
          ) : null}
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.two + 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 84, height: 84, borderRadius: Radius.md },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bold: { fontWeight: 600 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one },
});
