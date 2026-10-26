import { useState } from 'react';
import { Alert, View } from 'react-native';

import { RemoveFinished } from '@/components/remove-finished';
import { RentalCard } from '@/components/rental-card';
import { ReportStatus } from '@/components/report-status';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import { promptContract } from '@/lib/contract-prompt';
import type { RentalView } from '@/lib/rentals';
import { useFleet } from '@/store/fleet';

const ORDER = { pending: 0, accepted: 1, ended: 2, declined: 3, cancelled: 4 } as const;

/** Запити орендарів на мої опубліковані авто: прийняти або відхилити */
export function OwnerRentals() {
  const { reload, invalidate } = useFleet();
  const { data, loading, error, retry } = useReport<RentalView[]>('/rentals/incoming', { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  // Прийнятий запит уже оренда: вона на екрані авто («Зараз в оренді»), а тут лише те, що ще вирішується
  const sorted = [...(data ?? [])].filter((r) => !(r.dealId && r.status === 'accepted')).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  const pending = sorted.filter((r) => r.status === 'pending').length;

  async function respond(r: RentalView, action: 'accept' | 'decline') {
    setBusy(r.id);
    try {
      const res = await api<RentalView>('POST', `/rentals/${r.id}/${action}`);
      // Після прийняття змінюється авто (статус, водій), тож оновлюємо й автопарк
      if (action === 'accept') reload();
      invalidate();
      retry();
      if (action === 'accept') promptContract(res.dealId);
    } catch (e) {
      Alert.alert('Не вдалося', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const confirmAccept = (r: RentalView) =>
    Alert.alert(
      'Прийняти запит?',
      `Авто «${r.car.title}» отримає статус «В оренді», водієм стане ${r.counterpart.name}. Оголошення буде знято, а інші запити й пропозиції на це авто відхилено.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Прийняти', onPress: () => void respond(r, 'accept') },
      ],
    );

  const confirmDecline = (r: RentalView) =>
    Alert.alert('Відхилити запит?', `${r.counterpart.name} побачить, що запит відхилено, а у вас він зникне зі списку.`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Відхилити', style: 'destructive', onPress: () => void respond(r, 'decline') },
    ]);

  if (!data) return <ReportStatus loading={loading} error={error} onRetry={retry} />;

  return (
    <>
      {sorted.length === 0 ? (
        <EmptyState
          icon="mail-open-outline"
          title="Запитів поки немає"
          text="Опублікуйте вільне авто в оголошеннях (картка авто → «Опублікувати для орендарів»), і орендарі зможуть надсилати запити."
        />
      ) : (
        <>
          {pending > 0 ? (
            <ThemedText type="smallBold" themeColor="warning">
              Очікують вашої відповіді: {pending}
            </ThemedText>
          ) : null}
          <View style={{ gap: Spacing.three }}>
            {sorted.map((r) => (
              <RentalCard key={r.id} rental={r} viewer="owner">
                {r.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                    <Button title="Прийняти" icon="checkmark" variant="positive" style={{ flex: 1 }} disabled={busy === r.id} onPress={() => confirmAccept(r)} />
                    <Button title="Відхилити" icon="close" variant="danger" style={{ flex: 1 }} disabled={busy === r.id} onPress={() => confirmDecline(r)} />
                  </View>
                ) : null}
                {r.status === 'declined' || r.status === 'cancelled' || r.status === 'ended' ? <RemoveFinished path={`/rentals/${r.id}`} what="запит" onDone={retry} /> : null}
              </RentalCard>
            ))}
          </View>
        </>
      )}
    </>
  );
}
