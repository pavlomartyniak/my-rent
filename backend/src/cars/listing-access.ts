/** Що потрібно, щоб опублікувати авто: публікація вже відкрита, займає безкоштовне місце чи потребує оплати */
export type ListingAccess = 'unlocked' | 'free' | 'payment';

/**
 * Перші `limit` авто власника публікуються безкоштовно, кожне наступне потребує разової оплати. Безкоштовних місць
 * обмежена кількість: місце звільняє лише видалення авто, яке його займало. `freeUsed` — скільки місць уже зайнято
 * іншими авто цього власника.
 */
export function listingAccess(unlock: string | undefined, freeUsed: number, limit: number): ListingAccess {
  if (unlock === 'free' || unlock === 'paid') return 'unlocked';
  return freeUsed >= limit ? 'payment' : 'free';
}

/** Найменший вільний номер безкоштовного місця від 1 до `limit`; null, якщо всі зайняті */
export function freeSlot(taken: number[], limit: number): number | null {
  for (let n = 1; n <= limit; n++) if (!taken.includes(n)) return n;
  return null;
}
