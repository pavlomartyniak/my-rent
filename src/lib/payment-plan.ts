/**
 * План оплати оренди: одразу вся сума, щотижня чи щодня. Платіж вноситься наперед за період, що починається, перший у день
 * передачі авто. Тиждень збігається з виплатами таксі-агрегаторів, подобова оплата — для водіїв, які платять з денної виручки.
 * Оренда довша за календарний місяць: замість щодня — щотижня, щомісяця (за кожен календарний місяць) або одразу вся сума.
 */
export type PaymentPlan = 'lump' | 'weekly' | 'daily' | 'monthly';

/** Дата через n календарних місяців (31 січня + 1 міс. = останній день лютого); дзеркало серверного addMonths */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Оренда довша за календарний місяць: подобова оплата недоступна, є щомісячна */
export const isLongRental = (startDate: string, endDate: string) => endDate > addMonths(startDate, 1);

const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000));

export type ChoosablePlan = PaymentPlan;

const LABELS: Record<PaymentPlan, string> = { lump: 'вся сума одразу', weekly: 'щотижня', daily: 'щодня', monthly: 'щомісяця' };

/** Підпис плану для людей */
export const planLabel = (plan: PaymentPlan | null | undefined) => LABELS[plan ?? 'lump'] ?? LABELS.lump;

/** Які плани доступні для оренди з цими датами. Для тижня «щотижня» було б тим самим, що «одразу», тож воно від 8 діб */
export function availablePlans(startDate: string, endDate: string): ChoosablePlan[] {
  const days = daysBetween(startDate, endDate);
  if (isLongRental(startDate, endDate)) return ['lump', 'weekly', 'monthly'];
  if (days > 7) return ['lump', 'weekly', 'daily'];
  if (days >= 2) return ['lump', 'daily'];
  return ['lump'];
}

/** План, який справді діятиме: обраний, якщо підходить для строку, інакше вся сума одразу */
export function effectivePlan(startDate: string, endDate: string, plan: ChoosablePlan): ChoosablePlan {
  return availablePlans(startDate, endDate).includes(plan) ? plan : 'lump';
}
