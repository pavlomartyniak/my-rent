import { isIsoDay } from '../common/is-iso-day';

/** Чисті правила оренди, окремо від бази, щоб їх можна було тестувати */

export const MAX_RENTAL_DAYS = 365;

const MS_PER_DAY = 86_400_000;
const toTime = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();

/** Кількість діб між датами (мінімум одна доба, навіть якщо дати збігаються) */
export function rentalDays(startDate: string, endDate: string) {
  return Math.max(1, Math.round((toTime(endDate) - toTime(startDate)) / MS_PER_DAY));
}

export function totalPrice(pricePerDay: number, startDate: string, endDate: string) {
  return Math.round(pricePerDay * rentalDays(startDate, endDate) * 100) / 100;
}

/** Повертає текст помилки або null, якщо діапазон дат коректний. `today` — YYYY-MM-DD. */
export function validateRange(startDate: string, endDate: string, today: string): string | null {
  if (!isIsoDay(startDate) || !isIsoDay(endDate)) return 'Дати мають бути у форматі РРРР-ММ-ДД';
  if (startDate < today) return 'Дата початку не може бути в минулому';
  if (endDate < startDate) return 'Дата завершення раніше за дату початку';
  if (toTime(endDate) - toTime(startDate) > MAX_RENTAL_DAYS * MS_PER_DAY) return `Оренда не може бути довшою за ${MAX_RENTAL_DAYS} днів`;
  return null;
}

/** «Павло Мартиняк» → «Павло М.»: до підтвердження запиту прізвище приховане */
export function maskedName(firstName: string, lastName: string) {
  const initial = lastName.trim().charAt(0);
  return [firstName.trim(), initial ? `${initial.toUpperCase()}.` : ''].filter(Boolean).join(' ');
}

export const fullName = (firstName: string, lastName: string) => [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);
