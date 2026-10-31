/** Що потрібно, щоб опублікувати авто: публікація вже відкрита, займає безкоштовне місце чи потребує оплати */
export type ListingAccess = 'unlocked' | 'free' | 'payment';

/**
 * Перше авто власника публікується безкоштовно, кожне наступне потребує разової оплати. Безкоштовне місце одне:
 * його звільняє лише видалення авто, яке його займало.
 */
export function listingAccess(unlock: string | undefined, freeTaken: boolean): ListingAccess {
  if (unlock === 'free' || unlock === 'paid') return 'unlocked';
  return freeTaken ? 'payment' : 'free';
}
