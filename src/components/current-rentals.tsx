import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';

import { CarPhoto } from './car-photo';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';
import { SectionHeader } from './ui/section-header';

/**
 * Секція «Оренди» на головній власника: усі авто, які зараз здані чи чекають підписання, одним списком.
 * Тап відкриває авто з орендою, договором і платежами.
 */
export function CurrentRentals() {
  const router = useRouter();
  const theme = useTheme();
  const { data } = useReport<DealView[]>('/deals/current', { refetchOnFocus: true });
  if (!data?.length) return null;

  return (
    <>
      <SectionHeader title={`Оренди · ${data.length}`} />
      <Card style={styles.card}>
        {data.map((d, i) => (
          <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/car/[id]', params: { id: d.carId ?? '' } })}>
            <View style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={20} />
              <View style={styles.flex}>
                <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                  {d.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {d.counterpart.name} · {formatDate(d.startDate)} – {formatDate(d.endDate)}
                </ThemedText>
              </View>
              <StatusBadge status={dealStage(d)} />
              <Icon name="chevron-forward" size={18} color="textSecondary" />
            </View>
          </Pressable>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
