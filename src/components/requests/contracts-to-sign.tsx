import { StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { ContractCard } from '@/components/contract-card';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useAwaitingSignature } from '@/hooks/use-pending-requests';
import { formatDate } from '@/lib/date';

/**
 * Договори, які ще не підписані мною: стоять угорі вкладки «Запити», щоб наступний крок після прийняття був на виду.
 * Підписувати їх потрібно під час зустрічі; лічильник на вкладці рахує лише ті, що вже пора підписувати.
 */
export function ContractsToSign({ as }: { as: 'owner' | 'renter' }) {
  const deals = useAwaitingSignature();
  if (deals.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="default" style={styles.title}>
        Договори · {deals.length}
      </ThemedText>
      {deals.map((d) => (
        <Card key={d.id}>
          <View style={styles.head}>
            <CarPhoto uri={d.photoUri} style={styles.thumb} iconSize={20} />
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold} numberOfLines={1}>
                {d.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {d.counterpart.name} · {formatDate(d.startDate)} – {formatDate(d.endDate)}
              </ThemedText>
            </View>
          </View>
          <ContractCard deal={d} as={as} />
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
