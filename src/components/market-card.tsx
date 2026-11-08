import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatKm, formatMoney } from '@/lib/format';
import type { MarketCar } from '@/lib/rentals';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon, type IconName } from './ui/icon';

/** Дрібна характеристика авто: іконка й текст у сірій пігулці */
function Chip({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
      <Icon name={icon} size={15} color="textSecondary" />
      <ThemedText type="smallBold" numberOfLines={1}>
        {text}
      </ThemedText>
    </View>
  );
}

/** Оголошення в пошуку: велике фото з ціною за добу, назва з роком, місто, паливо й пробіг пігулками, застава */
export function MarketCard({ car }: { car: MarketCar }) {
  const router = useRouter();
  const theme = useTheme();
  const hasDeposit = car.deposit > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${car.brand} ${car.model}, ${car.city}, ${formatMoney(car.pricePerDay)} за добу, ${hasDeposit ? `застава ${formatMoney(car.deposit)}` : 'без застави'}`}
      onPress={() => router.push({ pathname: '/market/[id]', params: { id: car.id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.card}>
        <View>
          <CarPhoto uri={car.photoUri ?? undefined} style={styles.photo} iconSize={44} />
          <View style={[styles.price, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="default" style={styles.priceValue}>
              {formatMoney(car.pricePerDay)}{' '}
              <ThemedText type="small" themeColor="textSecondary">
                / доба
              </ThemedText>
            </ThemedText>
          </View>
          {car.myRequest ? (
            <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="positive" style={{ fontSize: 13 }}>
                ✓ Запит надіслано
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText type="default" style={[styles.title, styles.flex]} numberOfLines={1}>
              {car.brand} {car.model}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {car.year}
            </ThemedText>
          </View>

          <View style={styles.chips}>
            {car.city ? <Chip icon="location-outline" text={car.city} /> : null}
            {car.fuel ? <Chip icon="color-fill-outline" text={car.fuel} /> : null}
            {car.mileage ? <Chip icon="speedometer-outline" text={formatKm(car.mileage)} /> : null}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.deposit}>
            <Icon name={hasDeposit ? 'shield-outline' : 'shield-checkmark-outline'} size={20} color="textSecondary" />
            <ThemedText type="default" themeColor="textSecondary">
              {hasDeposit ? 'Застава' : 'Без застави'}
            </ThemedText>
            {hasDeposit ? (
              <ThemedText type="default" style={styles.bold}>
                {formatMoney(car.deposit)}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  card: { padding: 0, gap: 0, borderRadius: 28 },
  // Закруглюємо лише верх фото: overflow: hidden на картці прибрав би її тінь
  photo: { width: '100%', aspectRatio: 1.67, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  price: { position: 'absolute', left: 14, bottom: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  priceValue: { fontWeight: 700, fontSize: 18 },
  badge: { position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.pill },
  body: { padding: Spacing.three, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  title: { fontWeight: 700, fontSize: 22, lineHeight: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  divider: { height: StyleSheet.hairlineWidth },
  deposit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bold: { fontWeight: 700 },
});
