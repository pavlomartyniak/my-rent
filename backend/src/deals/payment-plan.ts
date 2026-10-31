import { rentalDays } from '../rentals/rentals.math';

/**
 * План оплати оренди: одразу вся сума, щотижня чи щодня. Платіж вноситься наперед за період, що починається,
 * перший у день передачі авто. Тижневий ритм збігається з виплатами таксі-агрегаторів, подобовий — для водіїв,
 * які платять з денної виручки. План погоджується в запиті чи пропозиції й фіксується в договорі.
 *
 * «Щомісяця» більше не пропонується, але угоди, укладені з ним раніше, працюють далі: графік уже зафіксовано в договорі.
 */
export type PaymentPlan = 'lump' | 'weekly' | 'daily' | 'monthly';

/** Плани, які можна обрати зараз */
export const PAYMENT_PLANS = ['lump', 'weekly', 'daily'] as const;
/** Скільки діб у платіжному періоді кожного плану з частинами */
export const PERIOD_DAYS = { weekly: 7, daily: 1, monthly: 30 } as const;

export type Installment = { n: number; dueDate: string; days: number; amount: number };

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Текст помилки, якщо план не підходить для такого строку; null — усе гаразд */
export function planError(plan: PaymentPlan, startDate: string, endDate: string): string | null {
  const days = rentalDays(startDate, endDate);
  if (plan === 'monthly') return 'Оплата щомісяця більше не пропонується: оберіть щотижня, щодня чи всю суму одразу';
  // Для оренди до тижня «щотижня» було б одним платежем, тобто тим самим, що «одразу»
  if (plan === 'weekly' && days <= PERIOD_DAYS.weekly) return `Оплата щотижня доступна для оренди довшої за ${PERIOD_DAYS.weekly} діб. Для коротшої оберіть щодня чи всю суму одразу`;
  if (plan === 'daily' && days < 2) return 'Оплата щодня доступна для оренди від 2 діб. Для однієї доби сплачується вся сума одразу';
  return null;
}

/**
 * Графік платежів. «Одразу» — один платіж на всю суму в день передачі авто. Інші плани — платіж за кожен період
 * (7 діб чи 1 добу), перший у день передачі, останній на залишок. Суми платежів у сумі дають вартість оренди.
 */
export function buildSchedule(startDate: string, endDate: string, pricePerDay: number, plan: PaymentPlan): Installment[] {
  const total = rentalDays(startDate, endDate);
  if (plan === 'lump') return [{ n: 1, dueDate: startDate, days: total, amount: round2(total * pricePerDay) }];
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
