import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PhotoGallery } from '@/components/photo-gallery';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { formatKm, formatMoney } from '@/lib/format';
import type { MarketCar } from '@/lib/rentals';

/** Оголошення: фото, умови й кнопка «Надіслати запит» */
export default function MarketCarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: car, loading, error, retry } = useReport<MarketCar>(`/market/cars/${id}`, { useCache: false });

  if (!car) {
    return (
      <Screen>
        {error?.includes('недоступне') || error?.includes('не знайдено') ? (
          <EmptyState icon="car-outline" title="Оголошення вже недоступне" text="Власник зняв його з публікації або авто здали." action="До пошуку" onAction={() => router.dismissTo('/renter/search')} />
        ) : (
          <ReportStatus loading={loading} error={error} onRetry={retry} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${car.brand} ${car.model}` }} />

      <PhotoGallery photos={car.photos?.length ? car.photos : car.photoUri ? [car.photoUri] : []} />

      <View>
        <ThemedText type="subtitle">
          {car.brand} {car.model}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {car.year} · {formatKm(car.mileage)} · {car.city}
        </ThemedText>
      </View>

      <Card>
        <View style={styles.price}>
          <ThemedText type="subtitle" themeColor="accent">
            {formatMoney(car.pricePerDay)}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            за добу
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Власник: {car.owner}
        </ThemedText>
      </Card>

      {car.description ? (
        <Card>
          <ThemedText type="default" style={styles.bold}>
            Опис
          </ThemedText>
          <ThemedText type="default">{car.description}</ThemedText>
        </Card>
      ) : null}

      {car.myRequest ? (
        <>
          <Card>
            <ThemedText type="default" style={styles.bold} themeColor="positive">
              ✓ Запит уже надіслано
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Власник ще не відповів. Повторно надсилати запит не потрібно. Відповідь і контакти з’являться у вкладці «Запити». Якщо передумали, скасуйте запит там.
            </ThemedText>
          </Card>
          <Button title="Мої запити" icon="file-tray-outline" variant="secondary" onPress={() => router.navigate('/renter/requests')} />
        </>
      ) : (
        <>
          <Button title="Надіслати запит на оренду" icon="paper-plane-outline" onPress={() => router.push({ pathname: '/market/request', params: { carId: car.id } })} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Запит нічого не бронює: власник прийме його або відхилить. Контакти відкриються після підтвердження.
          </ThemedText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  price: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  bold: { fontWeight: 700 },
  note: { textAlign: 'center' },
});
