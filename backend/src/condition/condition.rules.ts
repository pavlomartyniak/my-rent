/**
 * Фіксація стану авто при передачі (і за бажанням при поверненні): фото кузова й салону, показник одометра, пошкодження.
 * Це спільний доказ для обох сторін на випадок суперечки, тож правила тут жорсткі й чисті (без бази), щоб їх можна було тестувати.
 */
export const PHASES = ['handover', 'return'] as const;
export type Phase = (typeof PHASES)[number];

/** Обов'язкові фото при передачі: кузов з чотирьох боків і салон (панель з одометром, передні й задні сидіння) */
export const REQUIRED_SLOTS = ['front', 'rear', 'left', 'right', 'dashboard', 'seatsFront', 'seatsRear'] as const;
/** Додаткові фото, що не обов'язкові: багажник, колеса */
export const OPTIONAL_SLOTS = ['trunk', 'wheels'] as const;
export const SINGLE_SLOTS: readonly string[] = [...REQUIRED_SLOTS, ...OPTIONAL_SLOTS];
export type Slot = (typeof REQUIRED_SLOTS)[number] | (typeof OPTIONAL_SLOTS)[number];

export const SLOT_LABELS: Record<string, string> = {
  front: 'Спереду',
  rear: 'Ззаду',
  left: 'Ліва сторона',
  right: 'Права сторона',
  dashboard: 'Панель приладів з одометром',
  seatsFront: 'Передні сидіння',
  seatsRear: 'Задні сидіння',
  trunk: 'Багажник',
  wheels: 'Колеса',
};

export const MAX_DAMAGE_PHOTOS = 10;
/** Скільки годин після початку оренди (активації) можна додавати пошкодження, які знайшли не одразу */
export const LATE_DAMAGE_HOURS = 48;
/** За скільки днів до кінця оренди відкривається фіксація при поверненні і скільки днів вона відкрита після кінця */
export const RETURN_OPENS_DAYS_BEFORE = 1;
export const RETURN_OPEN_DAYS_AFTER = 14;

export type ConditionPhoto = { id: string; slot: string; url: string; by: 'owner' | 'renter'; at: Date; note?: string };
export type ConditionReport = { photos: ConditionPhoto[]; odometer?: { km: number; by: 'owner' | 'renter'; at: Date } };

/** Яких обов'язкових фото ще немає */
export function missingSlots(report: ConditionReport | undefined) {
  const have = new Set((report?.photos ?? []).map((p) => p.slot));
  return REQUIRED_SLOTS.filter((s) => !have.has(s));
}

/** Звіт при передачі готовий: усі обов'язкові фото й показник одометра */
export function handoverReady(report: ConditionReport | undefined) {
  return missingSlots(report).length === 0 && typeof report?.odometer?.km === 'number';
}

const DAY = 86_400_000;

type DealLike = { status?: string; startDate: string; endDate: string; contract?: { signedAt?: Date } };

/**
 * Що зараз дозволено з фото:
 * — передача: поки угоду не активовано (статус awaiting) обидві сторони додають, замінюють і видаляють свої фото; після активації лише
 *   додаються пошкодження протягом LATE_DAMAGE_HOURS, решта заморожена;
 * — повернення: відкривається за добу до кінця оренди й триває RETURN_OPEN_DAYS_AFTER днів після неї; фото додаються й замінюються.
 */
export function permissions(deal: DealLike, today: string, now: Date) {
  const awaiting = deal.status === 'awaiting';
  const active = deal.status === 'active';
  const signedAt = deal.contract?.signedAt;
  const lateOpen = active && !!signedAt && now.getTime() - signedAt.getTime() < LATE_DAMAGE_HOURS * 3_600_000;
  const lastDay = new Date(`${deal.endDate}T00:00:00Z`).getTime();
  const nowDay = new Date(`${today}T00:00:00Z`).getTime();
  const returnOpen = (active || deal.status === 'terminated') && nowDay >= lastDay - RETURN_OPENS_DAYS_BEFORE * DAY && nowDay <= lastDay + RETURN_OPEN_DAYS_AFTER * DAY;
  return {
    /** Додавати, замінювати й видаляти фото передачі */
    handoverEdit: awaiting,
    /** Лише додавати пошкодження при передачі, коли вже активовано */
    handoverLateDamage: lateOpen,
    returnEdit: returnOpen,
  };
}

/** Чи можна цією ж дією (слот, фаза) змінити фото при поточних правах */
export function canChange(phase: Phase, slot: string, perms: ReturnType<typeof permissions>) {
  if (phase === 'return') return perms.returnEdit;
  if (perms.handoverEdit) return true;
  return perms.handoverLateDamage && slot === 'damage';
}
