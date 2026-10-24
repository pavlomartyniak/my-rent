import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { Car } from '@/types';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/** Рядок авто в списку: назва зліва, прибуток за місяць справа */
export function CarCard({ car, profit }: { car: Car; profit?: number }) {
  return (
    <Link href={{ pathname: '/car/[id]', params: { id: car.id } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <Card style={styles.card}>
          <CarPhoto uri={car.photoUri} style={styles.thumb} />
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.name}>
              {car.brand} {car.model}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {car.year}
              {car.driver ? ` · ${car.driver}` : ''}
            </ThemedText>
          </View>
          <ThemedText type="default" style={styles.name} themeColor={profit === undefined ? 'textSecondary' : profit >= 0 ? 'positive' : 'negative'}>
            {profit === undefined ? '—' : formatMoney(profit)}
          </ThemedText>
          <Icon name="chevron-forward" size={18} color="textSecondary" />
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: Radius.md },
  flex: { flex: 1 },
  name: { fontWeight: 700 },
});
