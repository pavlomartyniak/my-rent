import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { Car } from '@/types';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';

/** Стан авто: колір плашки */
const STATUS_TONE: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = {
  'В оренді': 'positive',
  Вільне: 'accent',
  'На сервісі': 'warning',
  Заброньоване: 'warning',
};

/**
 * Авто в списку: компактний рядок із мініатюрою ліворуч, назвою, роком і водієм, станом плашкою та ціною за добу праворуч.
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

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/car/[id]', params: { id: car.id } }} asChild>
        <Pressable accessibilityRole="button">
          <View style={styles.row}>
          <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={30} />
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.name} numberOfLines={1}>
              {car.brand} {car.model}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {car.year}
              {car.driver ? ` · ${car.driver}` : ' · без водія'}
            </ThemedText>
            <View style={styles.meta}>
              <View style={[styles.badge, { backgroundColor: bg }]}>
                <ThemedText type="small" style={[styles.badgeText, { color: fg }]}>
                  {car.status}
                </ThemedText>
              </View>
              {price ? (
                <ThemedText type="smallBold" themeColor="positive" numberOfLines={1}>
                  {formatMoney(price)} <ThemedText type="small" themeColor="textSecondary">/доб</ThemedText>
                </ThemedText>
              ) : null}
            </View>
          </View>
          </View>
        </Pressable>
      </Link>
      {unpublished ? (
        <Button title="Опублікувати для орендарів" icon="megaphone-outline" variant="soft" onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.two + 2, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.85 },
  photo: { width: 72, height: 72, borderRadius: Radius.md },
  flex: { flex: 1, gap: 2 },
  name: { fontWeight: 700 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: 600 },
});
