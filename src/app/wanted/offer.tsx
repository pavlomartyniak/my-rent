import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { CarPhoto } from '@/components/car-photo';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { NumberField } from '@/components/ui/number-field';
import { Screen } from '@/components/ui/screen';
import { WantedCard } from '@/components/wanted-card';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { WantedView } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';

/** Пропозиція власника на заявку: вибір вільного авто, ціна за добу й повідомлення */
export default function OfferScreen() {
  const { wantedId } = useLocalSearchParams<{ wantedId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { cars, invalidate } = useFleet();
  const { data: wanted, loading, error, retry } = useReport<WantedView>(`/wanted/${wantedId}`, { useCache: false });

  const free = cars.filter((c) => c.status === 'Вільне');
  const [pickedId, setPickedId] = useState<string>();
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  // За замовчуванням — вільне авто, що підходить під заявку, а не просто перше в списку
  const fit = wanted?.matches?.map((m) => m.id) ?? [];
  const car = free.find((c) => c.id === pickedId) ?? free.find((c) => fit.includes(c.id)) ?? free[0];
  const suggestion = car?.listing?.pricePerDay ?? wanted?.maxPricePerDay ?? undefined;

  if (!wanted) {
    return (
      <Screen>
        {error?.includes('закрита') ? (
          <EmptyState icon="document-outline" title="Заявка вже закрита" text="Орендар прийняв іншу пропозицію або скасував заявку." action="Назад" onAction={() => router.back()} />
        ) : (
          <ReportStatus loading={loading} error={error} onRetry={retry} />
        )}
      </Screen>
    );
  }

  if (free.length === 0) {
    return (
      <Screen>
        <EmptyState icon="car-outline" title="Немає вільних авто" text="Щоб зробити пропозицію, авто має мати статус «Вільне». Змініть статус у редагуванні авто." action="Назад" onAction={() => router.back()} />
      </Screen>
    );
  }

  const priceError = Number(price) > 0 ? '' : 'Вкажіть ціну за добу';

  async function send() {
    if (sending || !car) return;
    setSubmitted(true);
    if (priceError) return;
    setSending(true);
    try {
      await api('POST', `/wanted/${wanted!.id}/offers`, { carId: car.id, pricePerDay: Number(price), message: message.trim() });
      invalidate();
      router.back();
      Alert.alert('Пропозицію надіслано', 'Орендар побачить її й відповість. Статус видно в «Моїх пропозиціях».');
    } catch (e) {
      Alert.alert('Не вдалося надіслати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <WantedCard wanted={wanted} viewer="owner" />

      <ThemedText type="small" themeColor="textSecondary">
        Яке авто пропонуєте
      </ThemedText>
      <View style={styles.cars}>
        {free.map((c) => {
          const selected = c.id === car?.id;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPickedId(c.id)}
              style={[styles.car, { borderColor: selected ? theme.accent : theme.borderStrong, backgroundColor: selected ? theme.accentSoft : theme.backgroundElement }]}>
              <CarPhoto uri={c.photoUri} style={styles.thumb} iconSize={20} />
              <View style={styles.flex}>
                <ThemedText type="default" style={styles.bold}>
                  {c.brand} {c.model} · {c.year}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.listing?.published ? `В оголошеннях: ${formatMoney(c.listing.pricePerDay)}/доба` : 'Вільне'}
                </ThemedText>
                {fit.includes(c.id) ? (
                  <ThemedText type="smallBold" themeColor="positive">
                    ✓ Підходить під заявку
                  </ThemedText>
                ) : null}
              </View>
              <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? 'accent' : 'textSecondary'} />
            </Pressable>
          );
        })}
      </View>

      <NumberField
        label="Ціна, ₴ за добу"
        value={price}
        onChangeValue={setPrice}
        error={submitted ? priceError : undefined}
        maxDigits={7}
        placeholder={suggestion ? String(suggestion) : '1 200'}
      />
      <Field
        label="Повідомлення орендарю (необов’язково)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        placeholder="Стан авто, умови, застава…"
        style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <Button title={sending ? 'Надсилаємо…' : 'Надіслати пропозицію'} icon="paper-plane-outline" disabled={sending} onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cars: { gap: Spacing.two },
  car: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.two, borderRadius: Radius.md, borderWidth: 1.5 },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
});
