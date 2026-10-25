import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import type { RentalView } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { MessageButton } from './message-button';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
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
        <StatusBadge status={r.status} />
      </View>

      <View style={styles.rows}>
        <Row label="Дати" value={`${formatDate(r.startDate)} – ${formatDate(r.endDate)}`} />
        <Row label="Тривалість" value={`${r.days} ${plural(r.days, 'доба', 'доби', 'діб')} × ${formatMoney(r.car.pricePerDay)}`} />
        <Row label="Орієнтовно" value={formatMoney(r.totalPrice)} bold />
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

      {r.status === 'accepted' && r.counterpart.phone ? (
        <Button title={`Зателефонувати: ${r.counterpart.phone}`} icon="call-outline" variant="positive" onPress={() => void Linking.openURL(`tel:${r.counterpart.phone!.replace(/[^\d+]/g, '')}`)} />
      ) : null}

      {r.status === 'pending' || r.status === 'accepted' ? <MessageButton context={{ rentalId: r.id }} title={`Написати: ${r.counterpart.name}`} /> : null}

      {children}
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
