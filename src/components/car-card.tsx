import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';
import type { Car } from '@/types';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';

/** Стан авто: колір плашки на фото */
const STATUS_TONE: Record<string, 'positive' | 'accent' | 'warning' | 'neutral'> = {
  'В оренді': 'positive',
  Вільне: 'accent',
  'На сервісі': 'warning',
  Заброньоване: 'warning',
};

/** Авто в списку: велике фото зі станом на ньому, під ним назва, опис і прибуток за місяць */
export function CarCard({ car, profit }: { car: Car; profit?: number }) {
  const theme = useTheme();
  const tone = STATUS_TONE[car.status] ?? 'neutral';
  const [bg, fg] = {
    positive: [theme.positiveSoft, theme.positive],
    accent: [theme.accentSoft, theme.accent],
    warning: [theme.warningSoft, theme.warning],
    neutral: [theme.backgroundSelected, theme.textSecondary],
  }[tone];

  return (
    <Link href={{ pathname: '/car/[id]', params: { id: car.id } }} asChild>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
        <View>
          <CarPhoto uri={car.photoUri} style={styles.photo} iconSize={44} />
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <ThemedText type="smallBold" style={{ color: fg, fontSize: 13 }}>
              {car.status}
            </ThemedText>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="default" style={styles.name} numberOfLines={1}>
              {car.brand} {car.model}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {car.year}
              {car.driver ? ` · ${car.driver}` : ''}
              {car.listing?.published && car.status === 'Вільне' ? ' · В оголошеннях' : ''}
            </ThemedText>
          </View>
          <View style={styles.profit}>
            <ThemedText type="default" style={styles.name} themeColor={profit === undefined ? 'textSecondary' : profit >= 0 ? 'positive' : 'negative'}>
              {profit === undefined ? '—' : formatMoney(profit)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              за місяць
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  pressed: { opacity: 0.85 },
  photo: { width: '100%', aspectRatio: 16 / 10, borderRadius: Radius.lg },
  badge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.pill },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, paddingHorizontal: 2 },
  flex: { flex: 1 },
  profit: { alignItems: 'flex-end' },
  name: { fontWeight: 600 },
});
