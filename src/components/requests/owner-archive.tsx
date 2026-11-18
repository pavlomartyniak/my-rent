import { View } from 'react-native';

import { OfferCard } from '@/components/offer-card';
import { RemoveFinished } from '@/components/remove-finished';
import { RentalCard } from '@/components/rental-card';
import { ReportStatus } from '@/components/report-status';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { offerArchived, rentalArchived } from '@/lib/archive';
import type { RentalView } from '@/lib/rentals';
import type { OfferView } from '@/lib/wanted';

/** Архів власника: відхилені, скасовані й завершені запити орендарів та мої закриті пропозиції. Тут вони не плутаються з активними. */
export function OwnerArchive() {
  const rentals = useReport<RentalView[]>('/rentals/incoming', { refetchOnFocus: true });
  const offers = useReport<OfferView[]>('/offers/mine', { refetchOnFocus: true });

  if (!rentals.data || !offers.data) return <ReportStatus loading={rentals.loading || offers.loading} error={rentals.error || offers.error} onRetry={() => { rentals.retry(); offers.retry(); }} />;

  const oldRentals = [...rentals.data].filter(rentalArchived).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const oldOffers = offers.data.filter(offerArchived);
  if (!oldRentals.length && !oldOffers.length) {
    return <EmptyState icon="archive-outline" title="Архів порожній" text="Сюди потрапляють відхилені, скасовані й завершені запити та пропозиції, щоб не заважати активним." />;
  }

  return (
    <>
      {oldRentals.length ? (
        <View style={{ gap: Spacing.three }}>
          <SectionHeader title="Запити орендарів" />
          {oldRentals.map((r) => (
            <RentalCard key={r.id} rental={r} viewer="owner">
              <RemoveFinished path={`/rentals/${r.id}`} what="запит" onDone={rentals.retry} />
            </RentalCard>
          ))}
        </View>
      ) : null}
      {oldOffers.length ? (
        <View style={{ gap: Spacing.three }}>
          <SectionHeader title="Мої пропозиції" />
          {oldOffers.map((o) => (
            <OfferCard key={o.id} offer={o} viewer="owner">
              <RemoveFinished path={`/offers/${o.id}`} what="пропозицію" onDone={offers.retry} />
            </OfferCard>
          ))}
        </View>
      ) : null}
    </>
  );
}
