/** Що потрібно, щоб опублікувати авто: публікація вже відкрита, авто займає вільне місце або місць уже немає (ліміт бета-версії) */
export type ListingAccess = 'unlocked' | 'free' | 'limit';

/**
 * У бета-версії власник публікує оголошення не більше ніж для `limit` авто. Місце звільняє знімання авто з публікації
 * (чи видалення авто). `used` — скільки місць уже зайнято іншими авто цього власника.
 */
export function listingAccess(unlock: string | undefined, used: number, limit: number): ListingAccess {
  if (unlock === 'free' || unlock === 'paid') return 'unlocked';
  return used >= limit ? 'limit' : 'free';
}

/** Авто знято з публікації: воно звільняє своє місце, щоб власник міг опублікувати інше авто (повторна публікація знову потребує місця) */
export function releaseListingSlot(car: { listingUnlock?: string; listingFreeSlot?: number }) {
  car.listingUnlock = undefined;
  car.listingFreeSlot = undefined;
}

/** Найменший вільний номер місця від 1 до `limit`; null, якщо всі зайняті */
export function freeSlot(taken: number[], limit: number): number | null {
  for (let n = 1; n <= limit; n++) if (!taken.includes(n)) return n;
  return null;
}
