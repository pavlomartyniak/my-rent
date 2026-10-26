import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatKm, formatMoney } from '@/lib/format';
import type { MarketCar } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';

/** Оголошення в пошуку: велике фото, назва й місто, ціна за добу */
export function MarketCard({ car }: { car: MarketCar }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.brand} ${car.model}, ${car.city}, ${formatMoney(car.pricePerDay)} за добу`}
      onPress={() => router.push({ pathname: '/market/[id]', params: { id: car.id } })}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <View>
        <CarPhoto uri={car.photoUri ?? undefined} style={styles.photo} iconSize={44} />
        {car.myRequest ? (
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="positive" style={{ fontSize: 13 }}>
              ✓ Запит надіслано
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold} numberOfLines={1}>
            {car.brand} {car.model} · {car.year}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {[car.city, car.fuel, formatKm(car.mileage)].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <ThemedText type="default" style={styles.bold}>
          {formatMoney(car.pricePerDay)}
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            / доба
          </ThemedText>
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  pressed: { opacity: 0.85 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.pill },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingHorizontal: 2 },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
});
