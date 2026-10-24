import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { lookupBrandId } from '@/lib/catalog';
import { openCatalogPicker } from '@/lib/catalog-picker';
import { isValidISODate, todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import { CAR_STATUSES, type Car } from '@/types';

import { Hint } from './hint';
import { PhotoPicker } from './photo-picker';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';
import { NumberField } from './ui/number-field';
import { PickerField } from './ui/picker-field';
import { Screen } from './ui/screen';
import { Segmented } from './ui/segmented';
import { ThemedText } from './themed-text';

const RENTED = CAR_STATUSES[0];
const MIN_YEAR = 1980;
const MAX_YEAR = new Date().getFullYear() + 1;

/** Роки для вибору (від новіших до старіших): період випуску моделі, якщо він відомий, інакше весь діапазон */
function yearOptions(range?: { from: number | null; to: number | null }) {
  const from = Math.min(Math.max(range?.from ?? MIN_YEAR, MIN_YEAR), MAX_YEAR);
  const to = Math.min(range?.to ?? MAX_YEAR, MAX_YEAR);
  const [lo, hi] = from <= to ? [from, to] : [MIN_YEAR, MAX_YEAR];
  return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
}

/** Форма додавання/редагування авто. Обов'язкове — тільки базове, решта в «Додатково». */
export function CarForm({ car }: { car?: Car }) {
  const router = useRouter();
  const { addCar, updateCar, deleteCar } = useFleet();

  const [brand, setBrand] = useState(car?.brand ?? '');
  // id марки в каталозі; для збереженого авто невідомий, знаходимо за назвою, коли потрібно
  const [brandId, setBrandId] = useState<number | undefined>();
  const [model, setModel] = useState(car?.model ?? '');
  // Роки випуску вибраної моделі з каталогу: обмежують список років
  const [modelYears, setModelYears] = useState<{ from: number | null; to: number | null } | undefined>();
  const [year, setYear] = useState(car ? String(car.year) : '');
  const [price, setPrice] = useState(car ? String(car.price) : '');
  const [vin, setVin] = useState(car?.vin ?? '');
  const [mileage, setMileage] = useState(car ? String(car.mileage) : '');
  const [driver, setDriver] = useState(car?.driver ?? '');
  const [rentStart, setRentStart] = useState(car?.rentStart ?? todayISO());
  // Галерея; для старих авто з одним фото беремо його
  const [photos, setPhotos] = useState<string[]>(car?.photos?.length ? car.photos : car?.photoUri ? [car.photoUri] : []);
  const [status, setStatus] = useState(car?.status ?? CAR_STATUSES[0]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const rented = status === RENTED;
  const yearNum = Number(year);
  const errors = {
    photo: photos.length ? '' : 'Додайте хоча б одне фото авто',
    brand: brand ? '' : 'Оберіть марку зі списку',
    model: model ? '' : 'Оберіть модель зі списку',
    year: Number.isInteger(yearNum) && yearNum >= MIN_YEAR && yearNum <= MAX_YEAR ? '' : 'Оберіть рік випуску',
    price: Number(price) > 0 ? '' : 'Потрібна для розрахунку окупності',
    vin: !vin.trim() || vin.trim().length === 17 ? '' : 'VIN має містити 17 символів',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  function pickBrand() {
    openCatalogPicker({
      kind: 'brand',
      selected: brand,
      onSelect: (b) => {
        // Інша марка — інша модель; ту саму марку лишаємо з поточною моделлю
        if (b.name !== brand) setModel('');
        setBrand(b.name);
        setBrandId(b.id);
      },
    });
  }

  async function pickModel() {
    let id = brandId;
    if (id === undefined) {
      try {
        id = (await lookupBrandId(brand)) ?? undefined;
      } catch {
        id = undefined;
      }
      if (id === undefined) {
        Alert.alert('Марку не знайдено в каталозі', 'Оберіть марку зі списку, щоб вибрати модель.');
        return;
      }
      setBrandId(id);
    }
    openCatalogPicker({ kind: 'model', brandId: id, brandName: brand, selected: model, onSelect: (m) => {
        const years = { from: m.yearFrom, to: m.yearTo };
        setModel(m.name);
        setModelYears(years);
        // Рік поза періодом випуску нової моделі скидаємо, щоб не лишилась неправдива пара
        const list = yearOptions(years);
        if (year && !list.includes(Number(year))) setYear('');
      },
    });
  }

  function pickYear() {
    openCatalogPicker({
      kind: 'year',
      years: yearOptions(modelYears),
      selected: year ? Number(year) : undefined,
      hint: modelYears?.from ? `${model} випускалась у ${modelYears.from}–${modelYears.to ?? 'зараз'} роках` : undefined,
      onSelect: (y) => setYear(String(y)),
    });
  }

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const data = {
      brand,
      model,
      year: yearNum,
      price: Number(price),
      vin: vin.trim().toUpperCase(),
      mileage: Math.round(Number(mileage)) || 0,
      rentStart: isValidISODate(rentStart) ? rentStart : todayISO(),
      status,
      // Для авто, яке не в оренді, водій не зберігається
      driver: rented ? driver.trim() : '',
      photos,
      photoUri: photos[0] ?? '',
    };
    setSaving(true);
    const ok = await (car ? updateCar(car.id, data) : addCar(data));
    setSaving(false);
    if (ok) router.back();
  }

  function onDelete() {
    if (!car) return;
    Alert.alert('Видалити авто?', 'Усі його записи та нагадування також буде видалено.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          if (await deleteCar(car.id)) router.dismissAll();
        },
      },
    ]);
  }

  return (
    <Screen>
      {!car ? <Hint id="car-form">Оберіть марку й модель зі списку, вкажіть рік, вартість і пробіг. VIN і водія можна залишити порожніми.</Hint> : null}
      <PhotoPicker value={photos} onChange={setPhotos} error={err('photo')} />
      <PickerField label="Марка" value={brand} placeholder="Оберіть марку" onPress={pickBrand} error={err('brand')} />
      <PickerField
        label="Модель"
        value={model}
        placeholder={brand ? 'Оберіть модель' : 'Спочатку оберіть марку'}
        onPress={() => void pickModel()}
        error={err('model')}
        disabled={!brand}
      />
      <PickerField
        label="Рік випуску"
        value={year}
        placeholder="Оберіть рік"
        onPress={pickYear}
        error={err('year')}
        hint={modelYears?.from ? `Модель випускалась: ${modelYears.from}–${modelYears.to ?? 'зараз'}` : undefined}
      />
      <NumberField label="Вартість авто, ₴" value={price} onChangeValue={setPrice} error={err('price')} maxDigits={10} placeholder="650 000" />

      <NumberField label="Пробіг, км" value={mileage} onChangeValue={setMileage} maxDigits={7} placeholder="120 000" />
      <Field label="VIN" value={vin} onChangeText={setVin} error={err('vin')} autoCapitalize="characters" autoCorrect={false} maxLength={17} placeholder="17 символів" />

      <View style={styles.group}>
        <ThemedText type="small" themeColor="textSecondary">
          Статус
        </ThemedText>
        <Segmented options={CAR_STATUSES} value={status} onChange={setStatus} />
      </View>

      {/* Водій і початок оренди потрібні лише для авто, яке зараз здане */}
      {rented ? (
        <>
          <Field label="Водій" value={driver} onChangeText={setDriver} placeholder="Ім'я водія" />
          <DateField label="Дата початку оренди" value={rentStart} onChange={setRentStart} />
        </>
      ) : null}

      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={onSave} />
      {car ? <Button title="Видалити авто" variant="danger" onPress={onDelete} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.one },
});
