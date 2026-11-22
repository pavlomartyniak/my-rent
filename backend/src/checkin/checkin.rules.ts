/**
 * Регулярний фотозвіт орендаря про авто («огляд»): власник вмикає його в оренді й обирає, що показувати.
 * Тут чисті правила без бази, щоб їх можна було тестувати: розклад, що вважається простроченим, обов'язкові фото.
 */
export const EVERY = ['weekly', 'biweekly', 'monthly'] as const;
export type Every = (typeof EVERY)[number];

export const EVERY_LABELS: Record<Every, string> = { weekly: 'щотижня', biweekly: 'раз на два тижні', monthly: 'щомісяця' };
export const WEEKDAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'] as const;

/** Налаштування звіту від власника. Панель приладів із пробігом обов'язкова завжди, кузов і салон за вибором */
export type CheckinSettings = { enabled: boolean; every: Every; /** 0 — неділя … 6 — субота (для щомісячного не використовується) */ weekday: number; body: boolean; interior: boolean; /** З якої дати рахуються строки (дата вмикання) */ since: string };

export type CheckinPhoto = { slot: string; url: string };
export type CheckinReport = { id: string; /** Строк, який закриває цей звіт (YYYY-MM-DD) */ due: string; at: Date; km: number; photos: CheckinPhoto[]; by: string };
export type CheckinState = { settings?: CheckinSettings; reports?: CheckinReport[]; lastRemindAt?: Date };

export const SLOT_LABELS: Record<string, string> = {
  dashboard: 'Панель приладів',
  front: 'Спереду',
  rear: 'Ззаду',
  left: 'Ліва сторона',
  right: 'Права сторона',
  seatsFront: 'Передні сидіння',
  seatsRear: 'Задні сидіння',
};

/** Фото, які треба зробити за цими налаштуваннями */
export function requiredSlots(s: Pick<CheckinSettings, 'body' | 'interior'>) {
  return ['dashboard', ...(s.body ? ['front', 'rear', 'left', 'right'] : []), ...(s.interior ? ['seatsFront', 'seatsRear'] : [])];
}

const DAY = 86_400_000;
const ms = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(ms(d) + n * DAY);

/** Дата в місяці `monthIndex` (від початку відліку), де день як у `anchor`, але не більше довжини місяця */
function monthlyDate(anchor: string, k: number) {
  const [y, m, d] = anchor.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1 + k, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last)));
}

/**
 * Усі строки звіту за оренду: після дати початку й не пізніше за кінець. Для щотижневих і дворазових на місяць береться обраний день
 * тижня (перший — не раніше ніж через тиждень чи два після початку), для щомісячних — той самий день місяця, що й початок оренди.
 */
export function dueDates(startDate: string, endDate: string, s: Pick<CheckinSettings, 'every' | 'weekday'>): string[] {
  const out: string[] = [];
  if (s.every === 'monthly') {
    for (let k = 1; k <= 60; k++) {
      const d = monthlyDate(startDate, k);
      if (d > endDate) break;
      out.push(d);
    }
    return out;
  }
  const step = s.every === 'weekly' ? 7 : 14;
  // Найближчий обраний день тижня, не раніше ніж через `step` днів після початку
  let d = addDays(startDate, step);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== s.weekday) d = addDays(d, 1);
  // Початок відліку для «раз на два тижні» не повинен залежати від того, наскільки далі впав день тижня
  d = addDays(d, 0);
  for (; d <= endDate && out.length < 400; d = addDays(d, step)) out.push(d);
  return out;
}

export type CheckinStatus = {
  /** none — звіт не потрібен, upcoming — ще не скоро, open — час надсилати (за добу до строку чи в день строку), overdue — строк минув */
  state: 'none' | 'upcoming' | 'open' | 'overdue';
  /** Строк, на який чекаємо (найближчий незакритий) */
  due: string | null;
  /** Незакриті строки, що вже настали чи настануть завтра */
  openDues: string[];
  /** Скільки строків минуло без звіту */
  overdueCount: number;
  /** На скільки днів прострочено найстаріший */
  overdueDays: number;
};

/**
 * Стан звітів на сьогодні. Звіт закриває свій строк і всі попередні, тож орендар, що забув про кілька тижнів, відправляє один звіт,
 * а не наздоганяє кожен. Рахуються лише строки від дати вмикання й лише поки оренда активна.
 */
export function checkinStatus(deal: { status?: string; startDate: string; endDate: string }, st: CheckinState | undefined, today: string): CheckinStatus {
  const none: CheckinStatus = { state: 'none', due: null, openDues: [], overdueCount: 0, overdueDays: 0 };
  const s = st?.settings;
  if (!s?.enabled || deal.status !== 'active') return none;
  const lastClosed = (st?.reports ?? []).reduce((max, r) => (r.due > max ? r.due : max), '');
  const pending = dueDates(deal.startDate, deal.endDate, s).filter((d) => d >= s.since && d > lastClosed);
  if (!pending.length) return none;
  const tomorrow = addDays(today, 1);
  const openDues = pending.filter((d) => d <= tomorrow);
  const overdue = pending.filter((d) => d < today);
  const due = pending[0]!;
  const state = overdue.length ? 'overdue' : openDues.length ? 'open' : 'upcoming';
  return { state, due, openDues, overdueCount: overdue.length, overdueDays: overdue.length ? Math.round((ms(today) - ms(overdue[0]!)) / DAY) : 0 };
}

/** Посилання на всі фото звітів (щоб прибрати їх із хмари з орендою й не вважати сиротами) */
export const checkinUrls = (st: CheckinState | undefined) => (st?.reports ?? []).flatMap((r) => r.photos.map((p) => p.url));

/** Опис вимоги для повідомлення в чат */
export function describeRequirement(s: Pick<CheckinSettings, 'every' | 'weekday' | 'body' | 'interior'>) {
  const when = s.every === 'monthly' ? 'щомісяця' : s.every === 'weekly' ? `щотижня (${WEEKDAYS[s.weekday]})` : `раз на два тижні (${WEEKDAYS[s.weekday]})`;
  const items = ['панель приладів із пробігом', ...(s.body ? ['кузов з усіх боків'] : []), ...(s.interior ? ['салон'] : [])];
  return `${when}: ${items.join(', ')}`;
}
