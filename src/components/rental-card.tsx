import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import { contactActions } from '@/lib/contact-actions';
import type { RentalView } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { FactTiles, TotalBar } from './request-facts';
import { PersonLink } from './person-link';
import { ContactChips } from './contact-chips';
import { StatusBadge } from './status-badge';
import { planLabel } from '@/lib/payment-plan';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

type Props = {
  rental: RentalView;
  /** Хто дивиться: власник бачить орендаря, орендар — власника */
  viewer: 'owner' | 'renter';
  /** Кнопки дій (прийняти, відхилити, скасувати) */
  children?: ReactNode;
};

/** Картка запиту на оренду: авто, дати, сума, повідомлення, статус і контакти */
export function RentalCard({ rental: r, viewer, children }: Props) {
  const router = useRouter();
  const who = viewer === 'owner' ? 'Орендар' : 'Власник';

  const facts = [
    { icon: 'calendar-outline' as const, label: 'Дати оренди', value: `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`, wide: true },
    ...(r.car.deposit ? [{ icon: 'shield-checkmark-outline' as const, label: 'Застава', value: formatMoney(r.car.deposit) }] : []),
    ...(r.paymentPlan !== 'lump' ? [{ icon: 'card-outline' as const, label: 'Оплата', value: planLabel(r.paymentPlan) }] : []),
  ];

  return (
    <Card style={styles.card}>
      <View>
        <CarPhoto uri={r.car.photoUri} style={styles.photo} iconSize={40} />
        <View style={styles.status}>
          <StatusBadge status={r.dealStage ?? r.status} />
        </View>
      </View>

      <View style={styles.body}>
        <View>
          <ThemedText type="headline" numberOfLines={2}>
            {r.car.title}
          </ThemedText>
          {r.car.city ? (
            <View style={styles.city}>
              <Icon name="location-outline" size={14} color="textSecondary" />
              <ThemedText type="callout" themeColor="textSecondary">
                {r.car.city}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <PersonLink id={r.counterpart.id} name={r.counterpart.name} photoUri={r.counterpart.photoUri} role={who} />

        <FactTiles items={facts} />

        <TotalBar calc={`${r.days} ${plural(r.days, 'доба', 'доби', 'діб')} × ${formatMoney(r.car.pricePerDay)}`} total={formatMoney(r.totalPrice)} note="Орієнтовна сума" />

      {r.message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          «{r.message}»
        </ThemedText>
      ) : null}

      {r.decisionNote ? (
        <ThemedText type="small" themeColor={r.status === 'declined' ? 'negative' : 'textSecondary'}>
          {r.decisionNote}
        </ThemedText>
      ) : null}

      {children}

      <ContactChips
        actions={contactActions({
            chat: (r.status === 'pending' || r.status === 'accepted') && { rentalId: r.id },
            contract: r.hasContract && r.dealId && (r.status === 'accepted' || r.status === 'ended') ? () => router.push({ pathname: '/contracts/[id]', params: { id: r.dealId! } }) : undefined,
          })}
      />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0 },
  photo: { width: '100%', height: 148, borderRadius: 0 },
  status: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  body: { padding: Spacing.three, gap: Spacing.three },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  message: { fontStyle: 'italic' },
});
