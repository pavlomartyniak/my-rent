/**
 * Вікно підписання договору. Договір підписують під час зустрічі, коли власник передає авто й ключі, а орендар — гроші,
 * тож підписання відкривається за добу до початку оренди й триває ще кілька діб після її початку.
 */
export const SIGN_DAYS_BEFORE = 1;
export const SIGN_DAYS_AFTER = 2;

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export type SigningState = 'early' | 'open' | 'late';

export function signingWindow(startDate: string) {
  return { opensAt: shift(startDate, -SIGN_DAYS_BEFORE), closesAt: shift(startDate, SIGN_DAYS_AFTER) };
}

/** early — підписувати ще рано, open — можна, late — час вийшов */
export function signingState(today: string, startDate: string): SigningState {
  const { opensAt, closesAt } = signingWindow(startDate);
  if (today < opensAt) return 'early';
  return today > closesAt ? 'late' : 'open';
}
