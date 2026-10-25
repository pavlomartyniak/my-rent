import { rentalDays } from '../rentals/rentals.math';

/**
 * План оплати оренди: одразу вся сума або щомісяця. Частинами можна платити лише за довгу оренду (від 60 діб),
 * коротку оплачують одразу. План погоджується в запиті чи пропозиції й фіксується в договорі.
 */
export type PaymentPlan = 'lump' | 'monthly';

export const PAYMENT_PLANS: readonly PaymentPlan[] = ['lump', 'monthly'];
/** Найкоротша оренда, за яку можна платити частинами */
export const MONTHLY_MIN_DAYS = 60;
/** Довжина одного платіжного періоду при оплаті частинами */
export const PERIOD_DAYS = 30;

export type Installment = { n: number; dueDate: string; days: number; amount: number };

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Текст помилки, якщо план не підходить для такого строку; null — усе гаразд */
export function planError(plan: PaymentPlan, startDate: string, endDate: string): string | null {
  if (plan === 'monthly' && rentalDays(startDate, endDate) < MONTHLY_MIN_DAYS) {
    return `Оплата частинами доступна для оренди від ${MONTHLY_MIN_DAYS} діб. Для коротшої оплачується вся сума одразу`;
  }
  return null;
}

/**
 * Графік платежів. «Одразу» — один платіж на всю суму в день передачі авто. «Щомісяця» — платіж за кожні
 * 30 діб (перший у день передачі), останній на залишок. Суми платежів у сумі дають вартість оренди.
 */
export function buildSchedule(startDate: string, endDate: string, pricePerDay: number, plan: PaymentPlan): Installment[] {
  const total = rentalDays(startDate, endDate);
  if (plan === 'lump') return [{ n: 1, dueDate: startDate, days: total, amount: round2(total * pricePerDay) }];
  const result: Installment[] = [];
  let left = total;
  for (let i = 0; left > 0; i++) {
    const days = Math.min(PERIOD_DAYS, left);
    result.push({ n: i + 1, dueDate: shift(startDate, i * PERIOD_DAYS), days, amount: round2(days * pricePerDay) });
    left -= days;
  }
  return result;
}

/** Підпис плану для людей */
export const planLabel = (plan: PaymentPlan) => (plan === 'monthly' ? 'щомісяця' : 'одразу вся сума');
