import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/date';
import { formatKm, formatMoney, plural } from '@/lib/format';
import { wantedTitle, type OfferView } from '@/lib/wanted';

import { CarPhoto } from './car-photo';
import { PhotoGallery } from './photo-gallery';
import { MessageButton } from './message-button';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';

type Props = {
  offer: OfferView;
  /** Орендар бачить велику галерею авто, власник — компактну картку зі своєю пропозицією */
  viewer: 'renter' | 'owner';
  children?: ReactNode;
};

/** Пропозиція власника на заявку: авто, ціна за добу, сума, повідомлення й контакти після прийняття */
export function OfferCard({ offer: o, viewer, children }: Props) {
  const photos = o.car.photos?.length ? o.car.photos : o.car.photoUri ? [o.car.photoUri] : [];
  const who = viewer === 'renter' ? 'Власник' : 'Орендар';

  return (
    <Card>
      {viewer === 'renter' ? (
        <PhotoGallery photos={photos} />
      ) : null}

      <View style={styles.head}>
        {viewer === 'owner' ? <CarPhoto uri={o.car.photoUri} style={styles.thumb} iconSize={22} /> : null}
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold}>
            {o.car.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatKm(o.car.mileage)}
          </ThemedText>
        </View>
        <StatusBadge status={o.dealStage ?? o.status} />
      </View>

      <View style={styles.rows}>
        {viewer === 'owner' ? <Row label="Заявка" value={`${wantedTitle(o.wanted)} · ${o.wanted.city}`} /> : null}
        <Row label="Дати" value={`${formatDate(o.wanted.startDate)} – ${formatDate(o.wanted.endDate)}`} />
        <Row label="Ціна" value={`${formatMoney(o.pricePerDay)} за добу`} />
        <Row label={`Разом за ${o.days} ${plural(o.days, 'добу', 'доби', 'діб')}`} value={formatMoney(o.totalPrice)} bold />
        <Row label={who} value={o.counterpart.name} />
      </View>

      {o.message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          «{o.message}»
        </ThemedText>
      ) : null}
      {o.decisionNote ? (
        <ThemedText type="small" themeColor={o.status === 'declined' ? 'negative' : 'textSecondary'}>
          {o.decisionNote}
        </ThemedText>
      ) : null}

      {o.status === 'accepted' && o.counterpart.phone ? (
        <Button title={`Зателефонувати: ${o.counterpart.phone}`} icon="call-outline" variant="positive" onPress={() => void Linking.openURL(`tel:${o.counterpart.phone!.replace(/[^\d+]/g, '')}`)} />
      ) : null}

      {o.status === 'pending' || o.status === 'accepted' ? <MessageButton context={{ offerId: o.id }} title={`Написати: ${o.counterpart.name}`} /> : null}

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
