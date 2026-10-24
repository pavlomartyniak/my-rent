import { useRouter } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { Hint } from '@/components/hint';
import { MarketCard } from '@/components/market-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { SearchInput } from '@/components/ui/search-input';
import { Spacing } from '@/constants/theme';
import { useMarketSearch } from '@/hooks/use-market-search';
import { plural } from '@/lib/format';
import { useState } from 'react';

/** Пошук вільних авто в оренду */
export default function SearchScreen() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const { items, total, error, loading, hasMore, loadMore, refresh } = useMarketSearch(city, maxPrice);

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} />}>
      <ThemedText type="subtitle">Авто в оренду</ThemedText>

      <Hint id="search">Введіть місто, щоб побачити вільні авто. Відкрийте оголошення й надішліть власнику запит на потрібні дати: він відповість прийняттям або відмовою.</Hint>

      <SearchInput value={city} onChangeText={setCity} placeholder="Місто, наприклад Київ" />
      <NumberField label="Ціна до, ₴ за добу (необов’язково)" value={maxPrice} onChangeValue={setMaxPrice} maxDigits={7} placeholder="2 000" />

      <Button title="Не знайшли? Створити заявку" icon="document-text-outline" variant="secondary" onPress={() => router.push('/wanted/new')} />

      {error ? (
        <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити" text={error} action="Спробувати ще раз" onAction={refresh} />
      ) : loading && items.length === 0 ? null : items.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Нічого не знайдено"
          text={city || maxPrice ? 'Спробуйте змінити місто чи ціну.' : 'Поки що немає вільних авто в оголошеннях. Зазирніть пізніше.'}
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
