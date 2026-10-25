import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import { contactActions } from '@/lib/contact-actions';
import type { RentalView } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { ContactChips } from './contact-chips';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';

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

  return (
    <Card>
      <View style={styles.head}>
        <CarPhoto uri={r.car.photoUri} style={styles.thumb} iconSize={22} />
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold} numberOfLines={1}>
            {r.car.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {r.car.city}
          </ThemedText>
        </View>
        <StatusBadge status={r.dealStage ?? r.status} />
      </View>

      <View style={styles.rows}>
        <Row label="Дати" value={`${formatDate(r.startDate)} – ${formatDate(r.endDate)}`} />
        {r.paymentPlan === 'monthly' ? <Row label="Оплата" value="щомісяця" /> : null}
        <Row label={`${r.days} ${plural(r.days, 'доба', 'доби', 'діб')} × ${formatMoney(r.car.pricePerDay)}`} value={formatMoney(r.totalPrice)} bold />
        <Row label={who} value={r.counterpart.name} />
      </View>

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
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={[styles.value, bold && styles.bold]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  rows: { gap: Spacing.one, marginTop: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { flexShrink: 1, fontWeight: 600, textAlign: 'right' },
  message: { fontStyle: 'italic' },
});
