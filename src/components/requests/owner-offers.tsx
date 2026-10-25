import { useState } from 'react';
import { Alert, View } from 'react-native';

import { RemoveFinished } from '@/components/remove-finished';
import { OfferCard } from '@/components/offer-card';
import { ReportStatus } from '@/components/report-status';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { api, ApiError } from '@/lib/api';
import type { OfferView } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';

/** Мої пропозиції на заявки орендарів і їхні статуси */
export function OwnerOffers() {
  const { invalidate } = useFleet();
  const { data, loading, error, retry } = useReport<OfferView[]>('/offers/mine', { refetchOnFocus: true });
  const [busy, setBusy] = useState<string | null>(null);

  async function withdraw(o: OfferView) {
    setBusy(o.id);
    try {
      await api('POST', `/offers/${o.id}/withdraw`);
      invalidate();
      retry();
    } catch (e) {
      Alert.alert('Не вдалося відкликати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const confirmWithdraw = (o: OfferView) =>
    Alert.alert('Відкликати пропозицію?', 'Орендар більше не побачить її, а у вас вона зникне зі списку.', [
      { text: 'Не відкликати', style: 'cancel' },
      { text: 'Відкликати', style: 'destructive', onPress: () => void withdraw(o) },
    ]);

  if (!data) return <ReportStatus loading={loading} error={error} onRetry={retry} />;

  return (
    <>
      {data.length === 0 ? (
        <EmptyState icon="paper-plane-outline" title="Пропозицій ще немає" text="Відкрийте «Заявки орендарів» і запропонуйте своє вільне авто." />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {data.map((o) => (
            <OfferCard key={o.id} offer={o} viewer="owner">
              {o.status === 'pending' ? <Button title="Відкликати пропозицію" variant="danger" disabled={busy === o.id} onPress={() => confirmWithdraw(o)} /> : null}
              {o.status === 'declined' || o.status === 'withdrawn' || o.status === 'ended' ? <RemoveFinished path={`/offers/${o.id}`} what="пропозицію" onDone={retry} /> : null}
            </OfferCard>
          ))}
        </View>
      )}
    </>
  );
}
