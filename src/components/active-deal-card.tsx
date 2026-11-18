import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { contactActions } from '@/lib/contact-actions';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney, splitTitle } from '@/lib/format';

import { CarPhoto } from './car-photo';
import { ColorDot } from './color-dot';
import { PlateBadge } from './plate-badge';
import { ContactChips } from './contact-chips';
import { ContractCard } from './contract-card';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';

/**
 * Авто, яке я орендую, у списку: такий самий компактний рядок, як у власника (CarCard): мініатюра ліворуч, назва з роком
 * і власником, стан плашкою та ціна за добу праворуч. Тап відкриває оренду з платежами, історією й записами.
 * Поки договір не підписано, під рядком стоїть картка підписання й швидкий чат.
 */
export function ActiveDealCard({ deal }: { deal: DealView }) {
  const stage = dealStage(deal);
  const { name, year } = splitTitle(deal.title);

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button">
          {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
          <View style={styles.row}>
            <CarPhoto uri={deal.photoUri} style={styles.photo} iconSize={30} />
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.name} numberOfLines={1}>
                {name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[year, deal.counterpart.name].filter(Boolean).join(' · ')}
              </ThemedText>
              {deal.car?.plate || deal.car?.color ? (
                <View style={styles.facts}>
                  {deal.car.plate ? <PlateBadge plate={deal.car.plate} small /> : null}
                  <ColorDot color={deal.car.color} />
                </View>
              ) : null}
              <View style={styles.meta}>
                <StatusBadge status={stage} />
                <ThemedText type="smallBold" themeColor="positive" numberOfLines={1}>
                  {formatMoney(deal.pricePerDay)} <ThemedText type="small" themeColor="textSecondary">/доб</ThemedText>
                </ThemedText>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>

      {stage === 'signing' ? (
        <>
          <ContractCard deal={deal} as="renter" />
          <ContactChips actions={contactActions({ chat: { dealId: deal.id } })} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.two + 2, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photo: { width: 72, height: 72, borderRadius: Radius.md },
  flex: { flex: 1, gap: 2 },
  name: { fontWeight: 700 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap', marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: 4 },
});
