import { rentalDays } from '../rentals/rentals.math';

/**
 * План оплати оренди: одразу вся сума, щотижня чи щодня. Платіж вноситься наперед за період, що починається,
 * перший у день передачі авто. Тижневий ритм збігається з виплатами таксі-агрегаторів, подобовий — для водіїв,
 * які платять з денної виручки. План погоджується в запиті чи пропозиції й фіксується в договорі.
 *
 * Для оренди довшої за календарний місяць (isLongRental) щодня платити не можна: замість цього — щотижня, щомісяця
 * (за кожен календарний місяць від дати передачі) або одразу вся сума.
 */
export type PaymentPlan = 'lump' | 'weekly' | 'daily' | 'monthly';

/** Плани, які можна обрати зараз */
export const PAYMENT_PLANS = ['lump', 'weekly', 'daily', 'monthly'] as const;
/** Скільки діб у платіжному періоді кожного плану з частинами */
/** Щомісячний план рахується за календарними місяцями (addMonths), тому тут лише тиждень і доба */
export const PERIOD_DAYS = { weekly: 7, daily: 1 } as const;

export type Installment = { n: number; dueDate: string; days: number; amount: number };

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00.000Z`).getTime() - new Date(`${a}T00:00:00.000Z`).getTime()) / DAY_MS);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Дата через n календарних місяців; якщо в місяці-цілі немає такого числа (31 січня + 1 міс.), береться його останній день */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Оренда довша за календарний місяць: завершення пізніше за початок плюс один місяць */
export const isLongRental = (startDate: string, endDate: string) => endDate > addMonths(startDate, 1);

/** Текст помилки, якщо план не підходить для такого строку; null — усе гаразд */
export function planError(plan: PaymentPlan, startDate: string, endDate: string): string | null {
  const days = rentalDays(startDate, endDate);
  const long = isLongRental(startDate, endDate);
  // Для оренди до тижня «щотижня» було б одним платежем, тобто тим самим, що «одразу»
  if (plan === 'weekly' && days <= PERIOD_DAYS.weekly) return `Оплата щотижня доступна для оренди довшої за ${PERIOD_DAYS.weekly} діб. Для коротшої оберіть щодня чи всю суму одразу`;
  if (plan === 'daily' && days < 2) return 'Оплата щодня доступна для оренди від 2 діб. Для однієї доби сплачується вся сума одразу';
  if (plan === 'daily' && long) return 'Для оренди довшої за місяць оплата щодня недоступна: оберіть щотижня, щомісяця чи всю суму одразу';
  if (plan === 'monthly' && !long) return 'Оплата щомісяця доступна для оренди довшої за місяць. Для коротшої оберіть щотижня, щодня чи всю суму одразу';
  return null;
}

/**
 * Графік платежів. «Одразу» — один платіж на всю суму в день передачі авто. Інші плани — платіж за кожен період
 * (7 діб, 1 добу чи календарний місяць), перший у день передачі, останній на залишок. Суми платежів у сумі дають вартість оренди.
 */
export function buildSchedule(startDate: string, endDate: string, pricePerDay: number, plan: PaymentPlan): Installment[] {
  const total = rentalDays(startDate, endDate);
  if (plan === 'lump') return [{ n: 1, dueDate: startDate, days: total, amount: round2(total * pricePerDay) }];
  if (plan === 'monthly') {
    const result: Installment[] = [];
    for (let i = 0; addMonths(startDate, i) < endDate; i++) {
      const from = addMonths(startDate, i);
      const to = addMonths(startDate, i + 1);
      const days = daysBetween(from, to < endDate ? to : endDate);
      result.push({ n: i + 1, dueDate: from, days, amount: round2(days * pricePerDay) });
    }
    return result;
  }
  const period = PERIOD_DAYS[plan];
  const result: Installment[] = [];
  let left = total;
  for (let i = 0; left > 0; i++) {
    const days = Math.min(period, left);
    result.push({ n: i + 1, dueDate: shift(startDate, i * period), days, amount: round2(days * pricePerDay) });
    left -= days;
  }
  return result;
}

const LABELS: Record<PaymentPlan, string> = { lump: 'одразу вся сума', weekly: 'щотижня', daily: 'щодня', monthly: 'щомісяця' };

/** Підпис плану для людей */
export const planLabel = (plan: PaymentPlan) => LABELS[plan] ?? LABELS.lump;
