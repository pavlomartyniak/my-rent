import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { isValidISODate, todayISO } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import { CAR_STATUSES, type Car } from '@/types';

import { Hint } from './hint';
import { PhotoPicker } from './photo-picker';
import { Button } from './ui/button';
import { DateField } from './ui/date-field';
import { Field } from './ui/field';
import { Screen } from './ui/screen';
import { Segmented } from './ui/segmented';
import { ThemedText } from './themed-text';

/** Форма додавання/редагування авто. Обов'язкове — тільки базове, решта в «Додатково». */
export function CarForm({ car }: { car?: Car }) {
  const router = useRouter();
  const { addCar, updateCar, deleteCar } = useFleet();

  const [brand, setBrand] = useState(car?.brand ?? '');
  const [model, setModel] = useState(car?.model ?? '');
  const [year, setYear] = useState(car ? String(car.year) : '');
  const [price, setPrice] = useState(car ? String(car.price) : '');
  const [more, setMore] = useState(!!car);
  const [vin, setVin] = useState(car?.vin ?? '');
  const [mileage, setMileage] = useState(car ? String(car.mileage) : '');
  const [driver, setDriver] = useState(car?.driver ?? '');
  const [rentStart, setRentStart] = useState(car?.rentStart ?? todayISO());
  const [photoUri, setPhotoUri] = useState(car?.photoUri);
  const [status, setStatus] = useState(car?.status ?? CAR_STATUSES[0]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const yearNum = Number(year);
  const errors = {
    photo: photoUri ? '' : 'Додайте фото авто',
    brand: brand.trim() ? '' : 'Вкажіть марку',
    model: model.trim() ? '' : 'Вкажіть модель',
    year: Number.isInteger(yearNum) && yearNum >= 1980 && yearNum <= new Date().getFullYear() + 1 ? '' : 'Вкажіть рік, напр. 2019',
    price: Number(price) > 0 ? '' : 'Потрібна для розрахунку окупності',
    vin: !vin.trim() || vin.trim().length === 17 ? '' : 'VIN має містити 17 символів',
  };
  const err = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  async function onSave() {
    if (saving) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      if (errors.vin) setMore(true);
      return;
    }
    const data = {
      brand: brand.trim(),
      model: model.trim(),
      year: yearNum,
      price: Number(price),
      vin: vin.trim().toUpperCase(),
      mileage: Math.round(Number(mileage)) || 0,
      rentStart: isValidISODate(rentStart) ? rentStart : todayISO(),
      status,
      driver: driver.trim(),
      photoUri,
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
      {!car ? <Hint id="car-form">Достатньо марки, моделі, року й вартості. Решту (водій, пробіг, VIN) можна додати пізніше через «Додатково».</Hint> : null}
      <PhotoPicker value={photoUri} onChange={setPhotoUri} error={err('photo')} />
      <Field label="Марка" value={brand} onChangeText={setBrand} error={err('brand')} placeholder="Toyota" autoFocus={!car} />
      <Field label="Модель" value={model} onChangeText={setModel} error={err('model')} placeholder="Camry" />
      <Field label="Рік випуску" value={year} onChangeText={setYear} error={err('year')} keyboardType="number-pad" maxLength={4} placeholder="2019" />
      <Field label="Вартість авто, ₴" value={price} onChangeText={setPrice} error={err('price')} keyboardType="number-pad" placeholder="650000" />

      {more ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Статус
          </ThemedText>
          <Segmented options={CAR_STATUSES} value={status} onChange={setStatus} />
          <Field label="Водій" value={driver} onChangeText={setDriver} />
          <Field label="Пробіг, км" value={mileage} onChangeText={setMileage} keyboardType="number-pad" />
          <Field label="VIN" value={vin} onChangeText={setVin} error={err('vin')} autoCapitalize="characters" autoCorrect={false} maxLength={17} />
          <DateField label="Дата початку оренди" value={rentStart} onChange={setRentStart} />
        </>
      ) : (
        <Button title="Додатково: водій, пробіг, VIN…" variant="secondary" onPress={() => setMore(true)} />
      )}

      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={onSave} />
      {car ? <Button title="Видалити авто" variant="danger" onPress={onDelete} /> : null}
    </Screen>
  );
}
