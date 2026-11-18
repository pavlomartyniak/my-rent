import { StyleSheet, View } from 'react-native';

import type { RatingSummary } from '@/lib/profiles';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** П'ять зірок із заповненням до десятих: цілі, половинка й порожні */
export function RatingStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Оцінка ${value} з 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={value >= i - 0.25 ? 'star' : value >= i - 0.75 ? 'star-half' : 'star-outline'} size={size} color="#F5A623" />
      ))}
    </View>
  );
}

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'оцінка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'оцінки' : 'оцінок');

/** Рейтинг одним рядком: зірки, середнє й кількість оцінок; без оцінок — «Ще немає оцінок» */
export function RatingLine({ rating, size = 14 }: { rating: RatingSummary; size?: number }) {
  // Без оцінок показуємо стартовий рейтинг (5,0): нуль виглядав би як найгірша оцінка
  const avg = rating.avg ?? 5;
  if (!rating.count) {
    return (
      <View style={styles.row}>
        <RatingStars value={avg} size={size} />
        <ThemedText type="smallBold">{avg.toFixed(1).replace('.', ',')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          · стартовий, ще без оцінок
        </ThemedText>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <RatingStars value={avg} size={size} />
      <ThemedText type="smallBold">{avg.toFixed(1).replace('.', ',')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        · {rating.count} {plural(rating.count)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 4 } });
