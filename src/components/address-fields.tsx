import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { fetchCities, fetchRegions, type Region } from '@/lib/places';

import { ThemedText } from './themed-text';
import { EmptyState } from './ui/empty-state';
import { Field } from './ui/field';
import { Icon } from './ui/icon';
import { IconButton } from './ui/icon-button';
import { PickerField } from './ui/picker-field';
import { SearchInput } from './ui/search-input';
import { ListSkeleton } from './ui/skeleton';

export type AddressValue = { region: string; city: string; street: string; building: string; apartment: string };
type Errors = Partial<Record<keyof AddressValue, string>>;

/**
 * Адреса проживання окремими полями: область і місто обираються зі списків (як у решті застосунку), вулиця, будинок і квартира
 * вводяться. Якщо населеного пункту немає в списку (частина сіл і селищ), його можна вписати вручну, область при цьому обирається завжди.
 */
export function AddressFields({ value, onChange, errors }: { value: AddressValue; onChange: (changes: Partial<AddressValue>) => void; errors: Errors }) {
  const [regionOpen, setRegionOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  // Клавіша «Далі» на клавіатурі веде вулиця → будинок → квартира, а на останньому полі ховає клавіатуру
  const buildingRef = useRef<ComponentRef<typeof TextInput>>(null);
  const apartmentRef = useRef<ComponentRef<typeof TextInput>>(null);
  const regionId = regions.find((r) => r.name === value.region)?.id;

  useEffect(() => {
    let cancelled = false;
    fetchRegions().then(
      (r) => !cancelled && setRegions(r),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <PickerField label="Область" value={value.region} placeholder="Оберіть область" error={errors.region} onPress={() => setRegionOpen(true)} />

      {manual ? (
        <View style={styles.wrap}>
          <Field
            label="Населений пункт"
            value={value.city}
            onChangeText={(city) => onChange({ city })}
            placeholder="Назва села чи селища"
            error={errors.city}
            autoCapitalize="words"
          />
          <Pressable accessibilityRole="button" onPress={() => setManual(false)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              Обрати зі списку
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <PickerField
          label="Місто чи село"
          value={value.city}
          placeholder={value.region ? 'Оберіть населений пункт' : 'Спершу оберіть область'}
          disabled={!value.region}
          error={errors.city}
          onPress={() => setCityOpen(true)}
        />
      )}

      <Field label="Вулиця" value={value.street} onChangeText={(street) => onChange({ street })} placeholder="Наприклад, Зелена" autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => buildingRef.current?.focus()} submitBehavior="submit" error={errors.street} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field
            ref={buildingRef}
            returnKeyType="next"
            onSubmitEditing={() => apartmentRef.current?.focus()}
            submitBehavior="submit"
            label="Будинок"
            value={value.building}
            onChangeText={(building) => onChange({ building: building.toUpperCase() })}
            placeholder="5А"
            maxLength={10}
            autoCapitalize="characters"
            error={errors.building}
          />
        </View>
        <View style={styles.flex}>
          <Field
            ref={apartmentRef}
            label="Квартира"
            value={value.apartment}
            onChangeText={(apartment) => onChange({ apartment: apartment.toUpperCase() })}
            placeholder="Якщо є"
            maxLength={8}
            autoCapitalize="characters"
            error={errors.apartment}
          />
        </View>
      </View>

      <RegionModal
        visible={regionOpen}
        regions={regions}
        selected={value.region}
        onClose={() => setRegionOpen(false)}
        // Інша область: місто з попередньої вже не підходить
        onSelect={(region) => onChange(region === value.region ? {} : { region, city: '' })}
      />
      <CityModal
        visible={cityOpen}
        regionId={regionId}
        regionName={value.region}
        selected={value.city}
        onClose={() => setCityOpen(false)}
        onSelect={(city) => onChange({ city })}
        onManual={() => {
          setCityOpen(false);
          setManual(true);
        }}
      />
    </View>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <ThemedText type="subtitle" style={styles.flex} numberOfLines={1}>
        {title}
      </ThemedText>
      <IconButton icon="close" label="Закрити" tone="neutral" onPress={onClose} />
    </View>
  );
}

function Option({ title, subtitle, selected, onPress, accent }: { title: string; subtitle?: string; selected?: boolean; onPress: () => void; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { borderBottomColor: theme.border }, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.flex}>
        <ThemedText type="default" themeColor={accent ? 'accent' : 'text'} style={styles.optionTitle}>
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

function RegionModal({
  visible,
  regions,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  regions: Region[];
  selected: string;
  onClose: () => void;
  onSelect: (name: string) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  // Область шукається за частиною назви без урахування регістру: «льв» знайде Львівську
  const q = query.trim().toLowerCase();
  const shown = q ? regions.filter((x) => x.name.toLowerCase().includes(q)) : regions;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SheetHeader title="Область" onClose={onClose} />
        <View style={styles.search}>
          <SearchInput value={query} onChangeText={setQuery} placeholder="Пошук області" />
        </View>
        {regions.length === 0 ? (
          <ListSkeleton />
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(r) => String(r.id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState icon="search-outline" title="Нічого не знайдено" text="Змініть запит." />}
            renderItem={({ item }) => (
              <Option
                title={item.name}
                selected={item.name === selected}
                onPress={() => {
                  onSelect(item.name);
                  onClose();
                }}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

type CityResult = { key: string; names: string[]; total: number; error: string | null };

function CityModal({
  visible,
  regionId,
  regionName,
  selected,
  onClose,
  onSelect,
  onManual,
}: {
  visible: boolean;
  regionId?: number;
  regionName: string;
  selected: string;
  onClose: () => void;
  onSelect: (city: string) => void;
  onManual: () => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<CityResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const key = `${regionId ?? ''}|${debounced}|${attempt}`;
  useEffect(() => {
    if (!visible || regionId === undefined) return;
    let cancelled = false;
    fetchCities({ regionId, q: debounced }).then(
      (c) => !cancelled && setResult({ key, names: c.items.map((x) => x.name), total: c.total, error: null }),
      (e) => !cancelled && setResult({ key, names: [], total: 0, error: e instanceof ApiError ? e.message : 'Не вдалося завантажити список' }),
    );
    return () => {
      cancelled = true;
    };
  }, [visible, regionId, debounced, key]);

  const current = result?.key === key ? result : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <SheetHeader title={regionName || 'Місто чи село'} onClose={onClose} />
        <View style={styles.search}>
          <SearchInput value={query} onChangeText={setQuery} placeholder="Пошук за назвою" />
        </View>
        {!current ? (
          <ListSkeleton />
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
            data={current.names}
            keyExtractor={(n, i) => `${n}-${i}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ListHeaderComponent={<Option accent title="Мого населеного пункту немає в списку" subtitle="Впишіть назву вручну" onPress={onManual} />}
            ListEmptyComponent={<EmptyState icon="search-outline" title="Нічого не знайдено" text="Змініть запит або впишіть назву вручну." />}
            ListFooterComponent={
              current.total > current.names.length ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
                  Показано {current.names.length} з {current.total}. Уточніть пошук.
                </ThemedText>
              ) : undefined
            }
            renderItem={({ item }) => (
              <Option
                title={item}
                selected={item === selected}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three },
  flex: { flex: 1 },
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  search: { padding: Spacing.three, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
  },
  optionTitle: { fontWeight: 600 },
  footer: { paddingVertical: Spacing.three, textAlign: 'center' },
});
