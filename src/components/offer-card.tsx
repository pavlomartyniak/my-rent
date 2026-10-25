import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { contactActions } from '@/lib/contact-actions';
import { formatDate } from '@/lib/date';
import { formatKm, formatMoney, plural } from '@/lib/format';
import { wantedTitle, type OfferView } from '@/lib/wanted';

import { CarPhoto } from './car-photo';
import { PhotoGallery } from './photo-gallery';
import { ContactChips } from './contact-chips';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';

type Props = {
  offer: OfferView;
  /** Орендар бачить велику галерею авто, власник — компактну картку зі своєю пропозицією */
  viewer: 'renter' | 'owner';
  children?: ReactNode;
};

/** Пропозиція власника на заявку: авто, ціна за добу, сума, повідомлення й контакти після прийняття */
export function OfferCard({ offer: o, viewer, children }: Props) {
  const router = useRouter();
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
        <Row label={`${o.days} ${plural(o.days, 'доба', 'доби', 'діб')} × ${formatMoney(o.pricePerDay)}`} value={formatMoney(o.totalPrice)} bold />
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

      {children}

      <ContactChips
        actions={contactActions({
            chat: (o.status === 'pending' || o.status === 'accepted') && { offerId: o.id },
            contract: o.hasContract && o.dealId && (o.status === 'accepted' || o.status === 'ended') ? () => router.push({ pathname: '/contracts/[id]', params: { id: o.dealId! } }) : undefined,
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
