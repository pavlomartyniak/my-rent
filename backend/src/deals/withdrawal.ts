/**
 * Одностороння відмова від договору (ч. 3 ст. 651 ЦК, п. 9.2–9.4 договору). Підстави — окремо для власника й орендаря.
 * Повідомлення вважається отриманим у момент доставки (e-mail доставлено чи відкрито в застосунку), а в усіх разі не пізніше
 * ніж через 12 годин після надсилання (п. 11.2). Договір розірвано через 12 годин після отримання (п. 9.4).
 */
export const OWNER_GROUNDS = ['payment_overdue', 'third_party', 'driver_missing', 'license_revoked', 'accident_fault'] as const;
export const RENTER_GROUNDS = ['car_unusable', 'false_warranties', 'force_majeure'] as const;
export const ALL_GROUNDS = [...OWNER_GROUNDS, ...RENTER_GROUNDS] as const;
export type Ground = (typeof ALL_GROUNDS)[number];

export const NOTICE_HOURS = 12;
const HOUR_MS = 3_600_000;

export const groundsFor = (role: 'owner' | 'renter'): readonly string[] => (role === 'owner' ? OWNER_GROUNDS : RENTER_GROUNDS);

type W = { at: Date | string; emailDeliveredAt?: Date | string; readAt?: Date | string };
const t = (d: Date | string) => new Date(d).getTime();

/** Коли повідомлення вважається отриманим */
export function receivedAt(w: W): Date {
  const candidates = [t(w.at) + NOTICE_HOURS * HOUR_MS];
  if (w.emailDeliveredAt) candidates.push(t(w.emailDeliveredAt));
  if (w.readAt) candidates.push(t(w.readAt));
  return new Date(Math.min(...candidates));
}

/** Коли договір вважається розірваним */
export const effectiveAt = (w: W): Date => new Date(receivedAt(w).getTime() + NOTICE_HOURS * HOUR_MS);
export const isEffective = (w: W, now = new Date()) => effectiveAt(w).getTime() <= now.getTime();

/** Підписи підстав відмови для листів і екрана */
export const GROUND_LABELS: Record<string, string> = {
  car_unusable: 'авто непридатне з вини наймодавця більш як 3 доби',
  false_warranties: 'гарантії власника щодо права на авто недостовірні',
  force_majeure: 'непереборна сила',
  payment_overdue: 'прострочка оплати понад 2 дні',
  third_party: 'передача авто іншій особі',
  driver_missing: 'орендар не виходить на зв’язок',
  license_revoked: 'позбавлення права керування',
  accident_fault: 'ДТП з вини орендаря',
};
