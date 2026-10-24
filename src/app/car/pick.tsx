import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { SearchInput } from '@/components/ui/search-input';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { fetchBrands, fetchModels } from '@/lib/catalog';
import { getPickerRequest, type PickerRequest } from '@/lib/catalog-picker';
import { fetchCities, fetchRegions, type City, type Region } from '@/lib/places';
import { plural } from '@/lib/format';

type Row = { id: number; title: string; subtitle?: string; select: () => void };
type Result = { q: string; rows: Row[]; total: number; error: string | null };

const yearsOf = (from: number | null, to: number | null) =>
  from ? `Роки випуску: ${from}–${to ?? 'зараз'}` : 'Роки випуску не вказано';

/** Екран вибору: марка, модель або рік випуску. Що саме показувати, вирішує форма авто через openCatalogPicker. */
export default function PickerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [request] = useState(() => getPickerRequest());

  if (!request) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Вибір' }} />
        <EmptyState icon="alert-circle-outline" title="Список недоступний" text="Відкрийте вибір із форми авто." action="Назад" onAction={() => router.back()} />
      </View>
    );
  }
  return request.kind === 'year' ? <YearList request={request} /> : request.kind === 'place' ? <PlaceList request={request} /> : <CatalogList request={request} />;
}

function SelectRow({ title, subtitle, selected, onPress }: { title: string; subtitle?: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <ThemedText type="default" style={styles.rowTitle}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Icon name={selected ? 'checkmark-circle' : 'chevron-forward'} size={selected ? 24 : 18} color={selected ? 'accent' : 'textSecondary'} />
    </Pressable>
  );
}

const YEAR_ROW_HEIGHT = 56;

/** Рік випуску: прокручуваний список, відкривається одразу на вибраному році */
function YearList({ request }: { request: Extract<PickerRequest, { kind: 'year' }> }) {
  const router = useRouter();
  const theme = useTheme();
  const index = Math.max(0, request.years.indexOf(request.selected ?? NaN));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Рік випуску' }} />
      {request.hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {request.hint}
        </ThemedText>
      ) : null}
      <FlatList
        data={request.years}
        keyExtractor={(year) => String(year)}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: YEAR_ROW_HEIGHT, offset: YEAR_ROW_HEIGHT * i, index: i })}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={{ height: YEAR_ROW_HEIGHT }}>
            <SelectRow
              title={String(item)}
              selected={item === request.selected}
              onPress={() => {
                request.onSelect(item);
                router.back();
              }}
            />
          </View>
        )}
      />
    </View>
  );
}

/** Марки або моделі з каталогу з пошуком */
function CatalogList({ request }: { request: Exclude<PickerRequest, { kind: 'year' | 'place' }> }) {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Пошук запускається після короткої паузи в наборі, щоб не слати запит на кожну літеру
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const done = (rows: Row[], total: number) => !cancelled && setResult({ q: debounced, rows, total, error: null });
    const choose = (select: () => void) => () => {
      select();
      router.back();
    };

    const load =
      request.kind === 'brand'
        ? fetchBrands(debounced).then((brands) =>
            done(
              brands.map((b) => ({
                id: b.id,
                title: b.name,
                subtitle: `${b.modelsCount} ${plural(b.modelsCount, 'модель', 'моделі', 'моделей')}`,
                select: choose(() => request.onSelect(b)),
              })),
              brands.length,
            ),
          )
        : fetchModels(request.brandId, debounced).then(({ items, total }) =>
            done(
              items.map((m) => ({
                id: m.id,
                title: m.name,
                subtitle: yearsOf(m.yearFrom, m.yearTo),
                select: choose(() => request.onSelect(m)),
              })),
              total,
            ),
          );

    load.catch((e) => {
      if (!cancelled) {
        setResult({ q: debounced, rows: [], total: 0, error: e instanceof ApiError ? e.message : 'Не вдалося завантажити список' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [request, debounced, attempt, router]);

  const title = request.kind === 'model' ? `Модель · ${request.brandName}` : 'Оберіть марку';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title }} />

      <View style={styles.search}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder={request.kind === 'brand' ? 'Пошук марки: Skoda, шкода…' : 'Пошук моделі'}
          autoFocus
        />
      </View>

      {!result ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : result.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Не вдалося завантажити"
          text={result.error}
          action="Спробувати ще раз"
          onAction={() => {
            setResult(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <FlatList
          data={result.rows}
          keyExtractor={(row) => String(row.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="search-outline" title="Нічого не знайдено" text="Змініть запит. Список складений із каталогу авто." />}
          ListFooterComponent={
            result.total > result.rows.length ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
                Показано {result.rows.length} з {result.total}. Уточніть пошук.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => <SelectRow title={item.title} subtitle={item.subtitle} selected={item.title === request.selected} onPress={item.select} />}
        />
      )}
    </View>
  );
}

type PlaceRow = { key: string; title: string; subtitle?: string; icon: 'chevron-forward' | 'checkmark-circle'; onPress: () => void };
type PlaceResult = { key: string; regions: Region[]; cities: City[]; total: number; error: string | null };

/**
 * Вибір місця: області → міста, з пошуком по містах усієї країни. У фільтрах можна обрати і «Уся область».
 */
function PlaceList({ request }: { request: Extract<PickerRequest, { kind: 'place' }> }) {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [result, setResult] = useState<PlaceResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const key = `${region?.id ?? ''}|${debounced}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    // Без пошуку й області показуємо лише області; інакше — міста (області чи всієї країни)
    const needCities = !!region || !!debounced;
    Promise.all([fetchRegions(), needCities ? fetchCities({ regionId: region?.id, q: debounced }) : Promise.resolve({ total: 0, items: [] as City[] })])
      .then(([regions, cities]) => !cancelled && setResult({ key, regions, cities: cities.items, total: cities.total, error: null }))
      .catch((e) => {
        if (!cancelled) setResult({ key, regions: [], cities: [], total: 0, error: e instanceof ApiError ? e.message : 'Не вдалося завантажити список' });
      });
    return () => {
      cancelled = true;
    };
  }, [key, region, debounced]);

  const choose = (place: { city?: string; regionId?: number; label: string }) => {
    request.onSelect(place);
    router.back();
  };

  const current = result?.key === key ? result : null;
  const rows: PlaceRow[] = [];
  if (current && !current.error) {
    if (region) {
      rows.push({ key: 'back', title: 'Усі області', icon: 'chevron-forward', onPress: () => setRegion(null) });
      if (request.allowRegion && !debounced) rows.push({ key: 'all', title: `Уся ${region.name}`, subtitle: 'Усі міста області', icon: 'checkmark-circle', onPress: () => choose({ regionId: region.id, label: region.name }) });
    } else if (debounced) {
      // Області, що підходять під запит, — щоб можна було обрати «Уся область» або відкрити її міста
      const q = debounced.toLowerCase();
      for (const r of current.regions.filter((x) => x.name.toLowerCase().includes(q))) {
        rows.push({ key: `r${r.id}`, title: r.name, subtitle: `${r.citiesCount} міст`, icon: 'chevron-forward', onPress: () => setRegion(r) });
      }
    } else {
      for (const r of current.regions) rows.push({ key: `r${r.id}`, title: r.name, subtitle: `${r.citiesCount} міст`, icon: 'chevron-forward', onPress: () => setRegion(r) });
    }
    for (const c of current.cities) {
      rows.push({ key: `c${c.id}`, title: c.name, subtitle: region ? undefined : c.region, icon: 'checkmark-circle', onPress: () => choose({ city: c.name, label: c.name }) });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: region ? region.name : request.allowRegion ? 'Місто або область' : 'Оберіть місто' }} />

      <View style={styles.search}>
        <SearchInput value={query} onChangeText={setQuery} placeholder={region ? `Пошук у ${region.name}` : 'Пошук міста: Львів, Біла Церква…'} />
      </View>

      {!current ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : current.error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Не вдалося завантажити"
          text={current.error}
          action="Спробувати ще раз"
          onAction={() => {
            setResult(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="search-outline" title="Нічого не знайдено" text="Змініть запит. Список складений з міст України." />}
          ListFooterComponent={
            current.total > current.cities.length ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
                Показано {current.cities.length} з {current.total}. Уточніть пошук.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <SelectRow title={item.title} subtitle={item.subtitle} selected={item.icon === 'checkmark-circle' && item.title === request.selected} onPress={item.onPress} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { padding: Spacing.three, paddingBottom: Spacing.two },
  hint: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: Spacing.half },
  rowTitle: { fontWeight: 600 },
  footer: { textAlign: 'center', paddingVertical: Spacing.three },
});
