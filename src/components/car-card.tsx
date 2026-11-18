import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { Car } from '@/types';

import { CarPhoto } from './car-photo';
import { ColorDot } from './color-dot';
import { PlateBadge } from './plate-badge';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';

/** Стан авто: колір плашки (колір + підпис, не лише колір) */
const STATUS_TONE: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = {
  'В оренді': 'positive',
  Вільне: 'accent',
  'На сервісі': 'warning',
  Заброньоване: 'warning',
};

/**
 * Авто в списку: велике фото зі станом на ньому, нижче назва, рік, водій, номер і ціна за добу.
 * Уся картка відкриває авто; окрема дія — лише «Опублікувати», коли оголошення ще немає.
 * Ціна — з оренди, що триває, а для вільного авто з оголошення.
 */
export function CarCard({ car, pricePerDay }: { car: Car; pricePerDay?: number }) {
  const theme = useTheme();
  const router = useRouter();
  const tone = STATUS_TONE[car.status] ?? 'neutral';
  // Вільне авто без оголошення орендарі не бачать у пошуку: пропонуємо опублікувати
  const unpublished = car.status === 'Вільне' && !car.listing?.published;
  const [bg, fg] = {
    positive: [theme.positiveSoft, theme.positive],
    accent: [theme.accentSoft, theme.accent],
    warning: [theme.warningSoft, theme.warning],
    neutral: [theme.backgroundSelected, theme.textSecondary],
  }[tone];
  const price = pricePerDay ?? car.listing?.pricePerDay;
  const title = `${car.brand} ${car.model}`;

  return (
    <Card
      onPress={() => router.push({ pathname: '/car/[id]', params: { id: car.id } })}
      label={`${title}, ${car.year}, ${car.status}${price ? `, ${formatMoney(price)} за добу` : ''}`}
      style={styles.card}>
      <View>
        <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={40} />
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <View style={[styles.dot, { backgroundColor: fg }]} />
          <ThemedText type="caption" style={{ color: fg }}>
            {car.status}
          </ThemedText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <ThemedText type="headline" style={styles.flex} numberOfLines={1}>
            {title}
          </ThemedText>
          {price ? (
            <ThemedText type="headline" themeColor="positive" numberOfLines={1}>
              {formatMoney(price)}
              <ThemedText type="callout" themeColor="textSecondary"> /доб</ThemedText>
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="callout" themeColor="textSecondary" numberOfLines={1}>
          {car.year}
          {car.driver ? ` · ${car.driver}` : ' · без водія'}
        </ThemedText>
        {car.plate || car.color ? (
          <View style={styles.facts}>
            {car.plate ? <PlateBadge plate={car.plate} small /> : null}
            <ColorDot color={car.color} />
          </View>
        ) : null}
      </View>

      {unpublished ? (
        <View style={styles.action}>
          <Button title="Опублікувати для орендарів" icon="megaphone-outline" variant="soft" compact onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0 },
  photo: { width: '100%', height: 156, borderRadius: 0 },
  badge: { position: 'absolute', top: Spacing.two, left: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { padding: Spacing.three, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  flex: { flex: 1 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.one },
  action: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
});
