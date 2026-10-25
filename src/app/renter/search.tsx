import { useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { Hint } from '@/components/hint';
import { MarketCard } from '@/components/market-card';
import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { PlaceFilter } from '@/components/place-field';
import type { Place } from '@/lib/places';
import { Spacing } from '@/constants/theme';
import { useMarketSearch } from '@/hooks/use-market-search';
import { plural } from '@/lib/format';
import { useState } from 'react';

/** Пошук вільних авто в оренду */
export default function SearchScreen() {
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const rangeError = Number(minPrice) > 0 && Number(maxPrice) > 0 && Number(minPrice) > Number(maxPrice) ? 'Верхня межа менша за нижню' : undefined;
  const { items, total, error, loading, hasMore, loadMore, refresh } = useMarketSearch(place?.city, place?.regionId, minPrice, maxPrice);

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} />}>
      <ScreenTitle>Авто в оренду</ScreenTitle>

      <Hint id="search">Введіть місто, щоб побачити вільні авто. Відкрийте оголошення й надішліть власнику запит на потрібні дати: він відповість прийняттям або відмовою.</Hint>

      <PlaceFilter value={place} onChange={setPlace} />
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <NumberField label="Ціна від, ₴/доба" value={minPrice} onChangeValue={setMinPrice} maxDigits={7} placeholder="500" />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="до, ₴/доба" value={maxPrice} onChangeValue={setMaxPrice} maxDigits={7} placeholder="2 000" error={rangeError} />
        </View>
      </View>

      <Button title="Не знайшли? Створити заявку" icon="document-text-outline" variant="secondary" onPress={() => router.push('/wanted/new')} />

      {error ? (
        <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити" text={error} action="Спробувати ще раз" onAction={refresh} />
      ) : loading && items.length === 0 ? null : items.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Нічого не знайдено"
          text={place || minPrice || maxPrice ? 'Спробуйте змінити місто чи ціну.' : 'Поки що немає вільних авто в оголошеннях. Зазирніть пізніше.'}
        />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Знайдено {total} {plural(total, 'оголошення', 'оголошення', 'оголошень')}
          </ThemedText>
          <View style={{ gap: Spacing.three }}>
            {items.map((car) => (
              <MarketCard key={car.id} car={car} />
            ))}
          </View>
          {hasMore ? <Button title="Показати ще" variant="secondary" disabled={loading} onPress={loadMore} /> : null}
        </>
      )}
    </Screen>
  );
}

