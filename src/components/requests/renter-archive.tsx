import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { RemoveFinished } from '@/components/remove-finished';
import { RentalCard } from '@/components/rental-card';
import { ReportStatus } from '@/components/report-status';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { WantedCard } from '@/components/wanted-card';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { rentalArchived, wantedArchived } from '@/lib/archive';
import type { RentalView } from '@/lib/rentals';
import type { WantedView } from '@/lib/wanted';

/** Архів орендаря: відхилені, скасовані й завершені запити та закриті заявки «шукаю авто». Тут вони не плутаються з активними. */
export function RenterArchive() {
  const router = useRouter();
  const rentals = useReport<RentalView[]>('/rentals/mine', { refetchOnFocus: true });
  const wanted = useReport<WantedView[]>('/wanted/mine', { refetchOnFocus: true });

  if (!rentals.data || !wanted.data) return <ReportStatus loading={rentals.loading || wanted.loading} error={rentals.error || wanted.error} onRetry={() => { rentals.retry(); wanted.retry(); }} />;

  const oldRentals = rentals.data.filter(rentalArchived);
  const oldWanted = wanted.data.filter(wantedArchived);
  if (!oldRentals.length && !oldWanted.length) {
    return <EmptyState icon="archive-outline" title="Архів порожній" text="Сюди потрапляють відхилені, скасовані й завершені запити та заявки, щоб не заважати активним." />;
  }

  return (
    <>
      {oldRentals.length ? (
        <View style={{ gap: Spacing.three }}>
          <SectionHeader title="Запити на авто" />
          {oldRentals.map((r) => (
            <RentalCard key={r.id} rental={r} viewer="renter">
              <RemoveFinished path={`/rentals/${r.id}`} what="запит" onDone={rentals.retry} />
            </RentalCard>
          ))}
        </View>
      ) : null}
      {oldWanted.length ? (
        <View style={{ gap: Spacing.three }}>
          <SectionHeader title="Заявки «Шукаю авто»" />
          {oldWanted.map((w) => (
            <Pressable key={w.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/wanted/[id]', params: { id: w.id } })}>
              <WantedCard wanted={w} viewer="renter" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}
