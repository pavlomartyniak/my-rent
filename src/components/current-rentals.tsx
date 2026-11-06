import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { daysUntil, formatDate } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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
                <View style={styles.head}>
                  <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={24} />
                  <View style={styles.flex}>
                    <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                      {d.title}
                    </ThemedText>
                    <View style={styles.person}>
                      <Icon name="person-outline" size={13} color="textSecondary" />
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {d.counterpart.name}
                      </ThemedText>
                    </View>
                  </View>
                  <Icon name="chevron-forward" size={18} color="textSecondary" />
                </View>
                <View style={[styles.panel, { backgroundColor: theme.backgroundSelected }]}>
                  <View style={styles.between}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                      {formatDate(d.startDate)} – {formatDate(d.endDate)}
                    </ThemedText>
                    {left !== null ? (
                      <ThemedText type="smallBold" themeColor="accent">
                        ще {left} {plural(left, 'доба', 'доби', 'діб')}
                      </ThemedText>
                    ) : null}
                  </View>
                  {stage === 'active' ? (
                    <View style={[styles.track, { backgroundColor: theme.borderStrong }]}>
                      <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.round(progress(d.startDate, d.endDate) * 100)}%` }]} />
                    </View>
                  ) : null}
                  <View style={styles.between}>
                    <StatusBadge status={stage} />
                    <ThemedText type="smallBold" themeColor="positive">
                      {formatMoney(d.pricePerDay)} <ThemedText type="small" themeColor="textSecondary">/доб</ThemedText>
                    </ThemedText>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

/** Яку частку оренди вже минуло: 0…1 */
function progress(start: string, end: string) {
  const total = daysUntil(end) - daysUntil(start);
  return total > 0 ? Math.min(1, Math.max(0, -daysUntil(start) / total)) : 1;
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  card: { padding: Spacing.two + 2, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  flex: { flex: 1, gap: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  panel: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  bold: { fontWeight: 700 },
});
