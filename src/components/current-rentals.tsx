import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { daysUntil, formatDate } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { plural } from '@/lib/format';

import { CarPhoto } from './car-photo';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';
import { EmptyState } from './ui/empty-state';

/**
 * Секція «Оренди» на головній власника: усі авто, які зараз здані чи чекають підписання, одним списком.
 * Тап відкриває авто з орендою, договором і платежами.
 */
export function CurrentRentals() {
  const router = useRouter();
  const { data } = useReport<DealView[]>('/deals/current', { refetchOnFocus: true });
  if (!data) return null;
  if (data.length === 0) return <EmptyState icon="key-outline" title="Зараз немає оренд" text="Коли ви приймете запит орендаря чи він прийме вашу пропозицію, оренда з’явиться тут." />;

  return (
    <>
      <View style={styles.list}>
        {data.map((d) => {
          const stage = dealStage(d);
          const left = stage === 'active' ? Math.max(0, daysUntil(d.endDate)) : null;
          return (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/car/[id]', params: { id: d.carId ?? '' } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
              <Card style={styles.card}>
                <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={26} />
                <View style={styles.flex}>
                  <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                    {d.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {d.counterpart.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {formatDate(d.startDate)} – {formatDate(d.endDate)}
                  </ThemedText>
                  <View style={styles.meta}>
                    <StatusBadge status={stage} />
                    {left !== null ? (
                      <ThemedText type="smallBold" themeColor="accent">
                        ще {left} {plural(left, 'доба', 'доби', 'діб')}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <Icon name="chevron-forward" size={18} color="textSecondary" />
              </Card>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two + 4 },
  thumb: { width: 88, height: 88, borderRadius: Radius.md },
  flex: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  bold: { fontWeight: 600 },
});
