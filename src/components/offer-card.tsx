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
import { InfoRow, InfoRows } from './ui/info-rows';

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
            {[o.car.fuel, formatKm(o.car.mileage)].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <StatusBadge status={o.dealStage ?? o.status} />
      </View>

      <InfoRows>
        {viewer === 'owner' ? <InfoRow label="Заявка" value={`${wantedTitle(o.wanted)} · ${o.wanted.city}`} /> : null}
        <InfoRow label="Дати" value={`${formatDate(o.wanted.startDate)} – ${formatDate(o.wanted.endDate)}`} />
        {o.paymentPlan === 'monthly' ? <InfoRow label="Оплата" value="щомісяця" /> : null}
        <InfoRow label={who} value={o.counterpart.name} />
        <InfoRow label={`${o.days} ${plural(o.days, 'доба', 'доби', 'діб')} × ${formatMoney(o.pricePerDay)}`} value={formatMoney(o.totalPrice)} strong />
      </InfoRows>

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

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: Radius.md },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  rows: { gap: Spacing.one, marginTop: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { flexShrink: 1, fontWeight: 600, textAlign: 'right' },
  message: { fontStyle: 'italic' },
});
