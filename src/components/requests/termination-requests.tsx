import { StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { TerminateDeal } from '@/components/terminate-deal';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useTerminationRequests } from '@/hooks/use-pending-requests';
import { formatDate } from '@/lib/date';

/** Пропозиції розірвати оренду від другої сторони: стоять угорі «Запитів», щоб їх не пропустити */
export function TerminationRequests({ as }: { as: 'owner' | 'renter' }) {
  const deals = useTerminationRequests();
  if (deals.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="default" style={styles.title}>
        Пропонують розірвати оренду · {deals.length}
      </ThemedText>
      {deals.map((d) => (
        <Card key={d.id}>
          <View style={styles.head}>
            <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={20} />
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                {d.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDate(d.startDate)} – {formatDate(d.endDate)}
              </ThemedText>
            </View>
          </View>
          <TerminateDeal deal={d} as={as} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  title: { fontWeight: 700, fontSize: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
