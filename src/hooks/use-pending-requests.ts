import { useReport } from '@/hooks/use-report';
import type { RentalView } from '@/lib/rentals';
import type { WantedView } from '@/lib/wanted';

/** Скільки запитів орендарів чекає відповіді власника; оновлюється раз на хвилину */
export function usePendingRequests() {
  const { data } = useReport<RentalView[]>('/rentals/incoming?status=pending', { refetchOnFocus: true, pollMs: 60_000 });
  return data?.length ?? 0;
}

/** Скільки пропозицій власників очікує рішення орендаря (по всіх моїх відкритих заявках) */
export function usePendingOffers() {
  const { data } = useReport<WantedView[]>('/wanted/mine', { refetchOnFocus: true, pollMs: 60_000 });
  return (data ?? []).reduce((sum, w) => sum + (w.offers?.pending ?? 0), 0);
}
