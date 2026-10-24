import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatKm, formatMoney } from '@/lib/format';
import type { MarketCar } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/** Оголошення в списку пошуку: фото, назва, місто й ціна за добу */
export function MarketCard({ car }: { car: MarketCar }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.brand} ${car.model}, ${car.city}, ${formatMoney(car.pricePerDay)} за добу`}
      onPress={() => router.push({ pathname: '/market/[id]', params: { id: car.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <CarPhoto uri={car.photoUri ?? undefined} style={styles.photo} iconSize={40} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.bold}>
              {car.brand} {car.model} · {car.year}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {car.city} · {formatKm(car.mileage)}
            </ThemedText>
          </View>
          <View style={styles.price}>
            <ThemedText type="default" style={styles.bold} themeColor="accent">
              {formatMoney(car.pricePerDay)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              за добу
            </ThemedText>
          </View>
          <Icon name="chevron-forward" size={18} color="textSecondary" />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: { gap: Spacing.three },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  price: { alignItems: 'flex-end' },
  bold: { fontWeight: 700 },
});
