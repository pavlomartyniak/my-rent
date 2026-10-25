import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { RemoveFinished } from '@/components/remove-finished';
import { RentalCard } from '@/components/rental-card';
import { ReportStatus } from '@/components/report-status';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import type { RentalView } from '@/lib/rentals';
import { useFleet } from '@/store/fleet';

/** Мої запити на оренду опублікованих авто та відповіді власників */
export function RenterRentals() {
  const router = useRouter();
  const { invalidate } = useFleet();
  const { data, loading, error, retry } = useReport<RentalView[]>('/rentals/mine', { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(r: RentalView) {
    setBusy(r.id);
    try {
      await api('POST', `/rentals/${r.id}/cancel`);
      invalidate();
    } catch (e) {
      Alert.alert('Не вдалося скасувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const confirmCancel = (r: RentalView) =>
    Alert.alert('Скасувати запит?', `Власник побачить, що запит скасовано, а у вас він зникне зі списку.`, [
      { text: 'Не скасовувати', style: 'cancel' },
      { text: 'Скасувати запит', style: 'destructive', onPress: () => void cancel(r) },
    ]);

  if (!data) return <ReportStatus loading={loading} error={error} onRetry={retry} />;

  // Прийнятий запит уже оренда: вона на «Головній», а тут лише те, що ще вирішується
  const open = data.filter((r) => !(r.dealId && r.status === 'accepted'));

  return (
    <>
      {open.length === 0 ? (
        <EmptyState
          icon="paper-plane-outline"
          title="Запитів ще немає"
          text="Знайдіть вільне авто й надішліть власнику запит на оренду."
          action="Знайти авто"
          onAction={() => router.navigate('/renter/search')}
        />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {open.map((r) => (
            <RentalCard key={r.id} rental={r} viewer="renter">
              {r.status === 'pending' ? <Button title="Скасувати запит" variant="danger" disabled={busy === r.id} onPress={() => confirmCancel(r)} /> : null}
              {r.status === 'declined' || r.status === 'cancelled' || r.status === 'ended' ? <RemoveFinished path={`/rentals/${r.id}`} what="запит" onDone={retry} /> : null}
            </RentalCard>
          ))}
        </View>
      )}
    </>
  );
}
