import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { NumberField } from '@/components/ui/number-field';
import { PickerField } from '@/components/ui/picker-field';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { openCatalogPicker } from '@/lib/catalog-picker';
import { fromISODate, toISODate } from '@/lib/date';
import { useFleet } from '@/store/fleet';

const addDays = (iso: string, n: number) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

/** Заявка «шукаю авто»: марка й модель (необов'язково), місто, дати, бюджет і побажання */
export default function NewWantedScreen() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const today = toISODate(new Date());

  const [brand, setBrand] = useState('');
  const [brandId, setBrandId] = useState<number | undefined>();
  const [model, setModel] = useState('');
  const [city, setCity] = useState('');
  const [start, setStart] = useState(addDays(today, 1));
  const [end, setEnd] = useState(addDays(today, 4));
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const cityError = city.trim() ? '' : 'Вкажіть місто';

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

  function pickModel() {
    if (brandId === undefined) return;
    openCatalogPicker({ kind: 'model', brandId, brandName: brand, selected: model, onSelect: (m) => setModel(m.name) });
  }

  function changeStart(value: string) {
    setStart(value);
    if (end < value) setEnd(value);
  }

  async function send() {
    if (sending) return;
    setSubmitted(true);
    if (cityError) return;
    setSending(true);
    try {
      await api('POST', '/wanted', {
        brand,
        model,
        city: city.trim(),
        startDate: start,
        endDate: end,
        ...(Number(budget) > 0 ? { maxPricePerDay: Number(budget) } : {}),
        notes: notes.trim(),
      });
      invalidate();
      router.dismissAll();
      router.navigate({ pathname: '/renter/requests', params: { tab: 'wanted' } });
      Alert.alert('Заявку створено', 'Власники побачать її й запропонують свої авто. Пропозиції з’являться в «Моїх заявках».');
    } catch (e) {
      Alert.alert('Не вдалося створити заявку', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Марку й модель вказувати необов’язково: без них власники запропонують будь-яке авто.
      </ThemedText>

      <PickerField label="Марка (необов’язково)" value={brand} placeholder="Будь-яка" onPress={pickBrand} />
      <PickerField label="Модель (необов’язково)" value={model} placeholder={brand ? 'Будь-яка' : 'Спочатку оберіть марку'} onPress={pickModel} disabled={!brand} />
      {brand ? (
        <Button
          title="Очистити марку й модель"
          variant="secondary"
          onPress={() => {
            setBrand('');
            setBrandId(undefined);
            setModel('');
          }}
        />
      ) : null}

      <Field label="Місто" value={city} onChangeText={setCity} error={submitted ? cityError : undefined} placeholder="Київ" maxLength={60} autoCapitalize="words" />
      <DateField label="Початок оренди" value={start} onChange={changeStart} minimumDate={new Date()} />
      <DateField label="Завершення оренди" value={end} onChange={setEnd} minimumDate={fromISODate(start)} />
      <NumberField label="Бюджет, ₴ за добу (необов’язково)" value={budget} onChangeValue={setBudget} maxDigits={7} placeholder="1 500" />
      <Field
        label="Побажання (необов’язково)"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={500}
        placeholder="Автомат, кондиціонер, місць для дітей…"
        style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
      />

      <View style={styles.actions}>
        <Button title={sending ? 'Створюємо…' : 'Створити заявку'} icon="paper-plane-outline" disabled={sending} onPress={send} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
});
