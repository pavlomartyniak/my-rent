import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { CityField } from '@/components/place-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';
import { MAX_LISTINGS } from '@/types';

/** Оголошення про оренду: місто, ціна за добу й опис. Його бачать усі орендарі, поки авто вільне. */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { cars, reload } = useFleet();
  const car = cars.find((c) => c.id === id);
  // Бета-версія: публікувати можна лише MAX_LISTINGS авто одночасно; авто, що вже опубліковане, можна редагувати без обмежень
  const limitReached = !!car && !car.listingUnlock && cars.filter((c) => c.id !== car.id && c.listingUnlock).length >= MAX_LISTINGS;

  const [city, setCity] = useState(car?.listing?.city ?? '');
  const [price, setPrice] = useState(car?.listing ? String(car.listing.pricePerDay) : '');
  const [deposit, setDeposit] = useState(car?.listing?.deposit ? String(car.listing.deposit) : '');
  const [description, setDescription] = useState(car?.listing?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Авто не знайдено" />
      </Screen>
    );
  }

  const cloudPhoto = !!car.photoUri?.startsWith('https://');
  const errors = {
    city: city.trim() ? '' : 'Оберіть місто',
    price: Number(price) > 0 ? '' : 'Вкажіть ціну за добу',
  };

  async function save() {
    if (saving || !car || limitReached) return;
    setSubmitted(true);
    if (errors.city || errors.price) return;
    setSaving(true);
    try {
      await api('PUT', `/cars/${car.id}/listing`, { city: city.trim(), pricePerDay: Number(price), deposit: Number(deposit) || 0, description: description.trim() });
      reload();
      router.back();
    } catch (e) {
      Alert.alert('Не вдалося опублікувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSaving(false);
    }
  }

  if (car.status !== 'Вільне') {
    return (
      <Screen>
        <EmptyState icon="car-outline" title="Авто не вільне" text="Опублікувати оголошення можна лише для авто зі статусом «Вільне». Змініть статус у редагуванні авто." />
      </Screen>
    );
  }

  if (!cloudPhoto) {
    return (
      <Screen>
        <EmptyState
          icon="image-outline"
          title="Потрібне фото авто"
          text="Орендарі бачать лише фото, завантажене на сервер. Відкрийте редагування авто й додайте фото заново."
          action="Редагувати авто"
          onAction={() => router.replace({ pathname: '/car/edit', params: { id: car.id } })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <CityField value={city} onChange={setCity} error={submitted ? errors.city : undefined} />
      <NumberField label="Ціна за добу, ₴" value={price} onChangeValue={setPrice} error={submitted ? errors.price : undefined} maxDigits={7} placeholder="1 200" />
      <NumberField label="Застава, ₴ (необов’язково)" value={deposit} onChangeValue={setDeposit} maxDigits={7} placeholder="0" />
      <ThemedText type="small" themeColor="textSecondary">
        Орендар вносить її разом із першою оплатою, а ви повертаєте після оренди. Сума потрапить у договір і буде видна в пошуку. Залиште порожнім, якщо застави немає.
      </ThemedText>
      <Field
        label="Опис (необов’язково)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        placeholder="Стан авто, умови, ліміт пробігу…"
        style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {limitReached ? (
        <Card>
          <ThemedText type="default" style={{ fontWeight: 600 }}>
            Ліміт бета-версії
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            У бета-версії застосунку можна публікувати лише до {MAX_LISTINGS} авто. Щоб опублікувати це, зніміть з публікації одне з уже опублікованих авто. Облік авто, доходів і витрат не обмежений.
          </ThemedText>
        </Card>
      ) : null}
      <Button
        title={saving ? 'Публікуємо…' : limitReached ? 'Ліміт бета-версії: 3 авто' : car.listing?.published ? 'Зберегти оголошення' : 'Опублікувати'}
        icon="megaphone-outline"
        disabled={saving || limitReached}
        onPress={save}
      />
    </Screen>
  );
}
