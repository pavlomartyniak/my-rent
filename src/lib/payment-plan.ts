/**
 * План оплати оренди: одразу вся сума, щотижня чи щодня. Платіж вноситься наперед за період, що починається, перший у день
 * передачі авто. Тиждень збігається з виплатами таксі-агрегаторів, подобова оплата — для водіїв, які платять з денної виручки.
 * «Щомісяця» більше не пропонується, але є в угодах, укладених раніше.
 */
export type PaymentPlan = 'lump' | 'weekly' | 'daily' | 'monthly';

/** Плани, які можна обрати зараз */
export type ChoosablePlan = Exclude<PaymentPlan, 'monthly'>;

const LABELS: Record<PaymentPlan, string> = { lump: 'вся сума одразу', weekly: 'щотижня', daily: 'щодня', monthly: 'щомісяця' };

/** Підпис плану для людей */
export const planLabel = (plan: PaymentPlan | null | undefined) => LABELS[plan ?? 'lump'] ?? LABELS.lump;

/** Які плани доступні для оренди на стільки діб. Для тижня «щотижня» було б тим самим, що «одразу», тож воно від 8 діб */
export function availablePlans(days: number): ChoosablePlan[] {
  if (days > 7) return ['lump', 'weekly', 'daily'];
  if (days >= 2) return ['lump', 'daily'];
  return ['lump'];
}

/** План, який справді діятиме: обраний, якщо підходить для строку, інакше вся сума одразу */
export function effectivePlan(days: number, plan: ChoosablePlan): ChoosablePlan {
  return availablePlans(days).includes(plan) ? plan : 'lump';
}
