import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { RemoveFinished } from '@/components/remove-finished';
import { OfferCard } from '@/components/offer-card';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { WantedCard } from '@/components/wanted-card';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { wantedTitle, type OfferView, type WantedOffers } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';

/** Моя заявка й пропозиції власників: прийняти найкращу або відхилити */
export default function WantedDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { invalidate } = useFleet();
  const { data, loading, error, retry } = useReport<WantedOffers>(`/wanted/${id}/offers`, { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<unknown>, failTitle: string) {
    setBusy(key);
    try {
      await action();
      invalidate();
      retry();
    } catch (e) {
      Alert.alert(failTitle, e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const confirmAccept = (o: OfferView) =>
    Alert.alert(
      'Прийняти пропозицію?',
      `Ви домовитесь із власником (${o.counterpart.name}) про авто «${o.car.title}». Заявку буде закрито, а інші пропозиції відхилено. Після цього ви побачите номер власника.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Прийняти', onPress: () => void run(o.id, () => api('POST', `/offers/${o.id}/accept`), 'Не вдалося прийняти') },
      ],
    );

  const confirmDecline = (o: OfferView) =>
    Alert.alert('Відхилити пропозицію?', `Власник побачить, що пропозицію відхилено.`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Відхилити', style: 'destructive', onPress: () => void run(o.id, () => api('POST', `/offers/${o.id}/decline`, {}), 'Не вдалося відхилити') },
    ]);

  const confirmCancel = () =>
    Alert.alert('Скасувати заявку?', 'Власники більше не бачитимуть її, а пропозиції буде відхилено.', [
      { text: 'Не скасовувати', style: 'cancel' },
      { text: 'Скасувати заявку', style: 'destructive', onPress: () => void run('cancel', () => api('POST', `/wanted/${id}/cancel`), 'Не вдалося скасувати') },
    ]);

  const confirmDelete = () =>
    Alert.alert('Видалити заявку?', 'Її більше не буде в списку. Цю дію не можна скасувати.', [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await api('DELETE', `/wanted/${id}`);
            invalidate();
            router.back();
          } catch (e) {
            Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
            setBusy(null);
          }
        },
      },
    ]);

  if (!data) {
    return (
      <Screen>
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  const { wanted, offers } = data;
  const open = wanted.status === 'open';

  return (
    <Screen>
      <Stack.Screen options={{ title: wantedTitle(wanted) }} />

      <WantedCard wanted={wanted} viewer="renter">
        {open ? <Button title="Скасувати заявку" variant="danger" disabled={busy === 'cancel'} onPress={confirmCancel} /> : null}
        {wanted.status === 'cancelled' ? (
          <View style={{ gap: Spacing.two }}>
            <Button
              title="Створити знову"
              icon="refresh"
              onPress={() =>
                router.push({
                  pathname: '/wanted/new',
                  params: { brand: wanted.brand, model: wanted.model, city: wanted.city, budget: wanted.maxPricePerDay ? String(wanted.maxPricePerDay) : '', notes: wanted.notes },
                })
              }
            />
            <Button title="Видалити заявку" icon="trash-outline" variant="danger" disabled={busy === 'delete'} onPress={confirmDelete} />
          </View>
        ) : null}
      </WantedCard>

      {wanted.status === 'cancelled' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Заявку скасовано. Створіть її знову: поля заповняться самі, лишиться вказати нові дати. Або видаліть її зі списку.
        </ThemedText>
      ) : (
        <>
      <SectionHeader title={`Пропозиції власників · ${offers.length}`} />
      {offers.length === 0 ? (
        <EmptyState icon="hourglass-outline" title="Пропозицій ще немає" text="Власники побачать вашу заявку й запропонують авто. Загляньте пізніше: список оновиться, коли повернетесь на цей екран." />
      ) : (
        <View style={{ gap: Spacing.three }}>
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} viewer="renter">
              {o.status === 'pending' && open ? (
                <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                  <Button title="Прийняти" icon="checkmark" variant="positive" style={{ flex: 1 }} disabled={busy === o.id} onPress={() => confirmAccept(o)} />
                  <Button title="Відхилити" icon="close" variant="danger" style={{ flex: 1 }} disabled={busy === o.id} onPress={() => confirmDecline(o)} />
                </View>
              ) : null}
              {o.status === 'declined' ? <RemoveFinished path={`/offers/${o.id}`} what="пропозицію" onDone={retry} /> : null}
            </OfferCard>
          ))}
        </View>
      )}
        </>
      )}
      {wanted.status === 'fulfilled' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Заявку виконано: ви прийняли пропозицію. Зателефонуйте власнику, щоб домовитись про передачу авто.
        </ThemedText>
      ) : null}
    </Screen>
  );
}
