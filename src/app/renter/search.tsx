import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { MarketCard } from '@/components/market-card';
import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { PickerField } from '@/components/ui/picker-field';
import { Segmented } from '@/components/ui/segmented';
import { lookupBrandId } from '@/lib/catalog';
import { openCatalogPicker } from '@/lib/catalog-picker';
import { FUEL_TYPES, type FuelType } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { PlaceFilter } from '@/components/place-field';
import type { Place } from '@/lib/places';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useMarketSearch } from '@/hooks/use-market-search';
import { plural } from '@/lib/format';
import { useState } from 'react';

/** Пошук вільних авто в оренду */
export default function SearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [brandId, setBrandId] = useState<number | undefined>();
  const [model, setModel] = useState('');
  const [fuel, setFuel] = useState('');
  const rangeError = Number(minPrice) > 0 && Number(maxPrice) > 0 && Number(minPrice) > Number(maxPrice) ? 'Верхня межа менша за нижню' : undefined;
  const { items, total, error, loading, hasMore, loadMore, refresh } = useMarketSearch(place?.city, place?.regionId, minPrice, maxPrice, { brand, model, fuel });

  const summary = [brand && `${brand}${model ? ` ${model}` : ''}`, fuel, minPrice || maxPrice ? `${minPrice || '0'}–${maxPrice || '∞'} ₴/доба` : 'Будь-яка ціна'].filter(Boolean).join(' · ');
  const filtered = !!(place || brand || model || fuel || minPrice || maxPrice);

  function pickBrand() {
    openCatalogPicker({
      kind: 'brand',
      selected: brand,
      onSelect: (b) => {
        if (b.name !== brand) setModel('');
        setBrand(b.name);
        setBrandId(b.id);
      },
    });
  }

  async function pickModel() {
    let id = brandId;
    if (id === undefined) {
      id = (await lookupBrandId(brand).catch(() => null)) ?? undefined;
      setBrandId(id);
    }
    if (id === undefined) return;
    openCatalogPicker({ kind: 'model', brandId: id, brandName: brand, selected: model, onSelect: (m) => setModel(m.name) });
  }

  function reset() {
    setPlace(null);
    setBrand('');
    setBrandId(undefined);
    setModel('');
    setFuel('');
    setMinPrice('');
    setMaxPrice('');
  }

  return (
    <Screen tabs refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={refresh} />}>
      <ScreenTitle>Авто в оренду</ScreenTitle>

      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, !dark && styles.shadow]}>
        <Icon name="search" size={22} color="text" />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {place ? place.city || place.label : 'Уся Україна'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {summary}
          </ThemedText>
        </View>
        <Icon name={open ? 'chevron-up' : 'options-outline'} size={20} color="textSecondary" />
      </Pressable>

      {open ? (
        <Card style={{ gap: Spacing.three }}>
          <PlaceFilter value={place} onChange={setPlace} />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <View style={{ flex: 1 }}>
              <PickerField label="Марка" value={brand} placeholder="Будь-яка" onPress={pickBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <PickerField label="Модель" value={model} placeholder={brand ? 'Будь-яка' : 'Спершу марка'} onPress={() => void pickModel()} disabled={!brand} />
            </View>
          </View>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="smallBold">Тип палива</ThemedText>
            <Segmented scroll options={FUEL_TYPES} value={fuel as FuelType} onChange={(f) => setFuel(f === fuel ? '' : f)} />
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <View style={{ flex: 1 }}>
              <NumberField label="Ціна від, ₴/доба" value={minPrice} onChangeValue={setMinPrice} maxDigits={7} placeholder="500" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="до, ₴/доба" value={maxPrice} onChangeValue={setMaxPrice} maxDigits={7} placeholder="2 000" error={rangeError} />
            </View>
          </View>
          {filtered ? <Button title="Скинути фільтри" variant="soft" onPress={reset} /> : null}
        </Card>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/wanted/new')} style={[styles.ask, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name="create-outline" size={22} color="text" />
        <View style={styles.flex}>
          <ThemedText type="smallBold">Не знайшли?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Опишіть авто, а власники самі запропонують
          </ThemedText>
        </View>
        <Icon name="chevron-forward" size={18} color="textSecondary" />
      </Pressable>

      {error ? (
        <EmptyState icon="cloud-offline-outline" title="Не вдалося завантажити" text={error} action="Спробувати ще раз" onAction={refresh} />
      ) : loading && items.length === 0 ? null : items.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="Нічого не знайдено"
          text={filtered ? 'Спробуйте змінити марку, паливо, місто чи ціну.' : 'Поки що немає вільних авто в оголошеннях. Зазирніть пізніше.'}
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


const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.pill, borderWidth: 1, paddingVertical: 12, paddingHorizontal: Spacing.three },
  shadow: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.lg, padding: Spacing.three },
  flex: { flex: 1 },
});
