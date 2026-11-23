import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Car } from '@/types';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Вільне авто без оголошення: орендарі його не бачать. Банер на екрані авто пояснює це й веде до публікації,
 * щоб власник не гадав, чому немає запитів. Для авто в оренді чи на сервісі й для вже опублікованих не показується.
 */
export function PublishBanner({ car }: { car: Car }) {
  const theme = useTheme();
  const router = useRouter();
  if (car.status !== 'Вільне' || car.listing?.published) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: theme.accent }]}>
          <Icon name="eye-off-outline" size={22} color="onAccent" />
        </View>
        <View style={styles.body}>
          <ThemedText type="smallBold" themeColor="accent">
            НЕ ОПУБЛІКОВАНО
          </ThemedText>
          <ThemedText type="subtitle" style={styles.title}>
            Орендарі ще не бачать це авто
          </ThemedText>
        </View>
      </View>
      <ThemedText type="default" themeColor="textSecondary">
        Опублікуйте оголошення, щоб авто з’явилось у пошуку й ви почали отримувати запити на оренду. Це займе хвилину.
      </ThemedText>
      <Button title="Опублікувати для орендарів" icon="megaphone-outline" onPress={() => router.push({ pathname: '/car/listing', params: { id: car.id } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 18, lineHeight: 24 },
});
