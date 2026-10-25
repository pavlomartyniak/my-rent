import { useReport } from '@/hooks/use-report';
import type { RentalView } from '@/lib/rentals';
import type { DealView } from '@/lib/deals';
import type { WantedView } from '@/lib/wanted';

/** Скільки запитів орендарів чекає відповіді власника; оновлюється раз на 5 хвилин (запасний канал, основне оновлення йде по сокету) */
export function usePendingRequests() {
  const { data } = useReport<RentalView[]>('/rentals/incoming?status=pending', { refetchOnFocus: true, pollMs: 300_000 });
  return data?.length ?? 0;
}

/** Скільки пропозицій власників очікує рішення орендаря (по всіх моїх відкритих заявках) */
export function usePendingOffers() {
  const { data } = useReport<WantedView[]>('/wanted/mine', { refetchOnFocus: true, pollMs: 300_000 });
  return (data ?? []).reduce((sum, w) => sum + (w.offers?.pending ?? 0), 0);
}

/** Оренди, де друга сторона запропонувала розірвати угоду й чекає моєї відповіді (і для власника, і для орендаря) */
export function useTerminationRequests() {
  const { data } = useReport<DealView[]>('/deals/termination-requests', { refetchOnFocus: true, pollMs: 300_000 });
  return data ?? [];
}

/** Договори, які ще не підписані мною (і для власника, і для орендаря): від сформованих до тих, що вже пора підписувати */
export function useAwaitingSignature() {
  const { data } = useReport<DealView[]>('/deals/awaiting-signature', { refetchOnFocus: true, pollMs: 300_000 });
  return data ?? [];
}

/** Лише ті, що пора підписувати прямо зараз (відкрите вікно підписання): вони потрапляють у лічильники */
export function useSigningNow() {
  return useAwaitingSignature().filter((d) => d.contract?.signing.state === 'open');
}
