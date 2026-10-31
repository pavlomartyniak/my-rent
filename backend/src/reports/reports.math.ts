/**
 * Чисті функції розрахунку звітів (без бази й залежностей), щоб їх було легко тестувати.
 * Суми приходять із агрегацій MongoDB, тут вони перетворюються на показники.
 */

export type Totals = { income: number; expense: number; profit: number };
export type SeriesPoint = Totals & { month: string };
export type CategoryShare = { category: string; amount: number; share: number };

export const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function totalsOf(income: number, expense: number): Totals {
  return { income: round2(income), expense: round2(expense), profit: round2(income - expense) };
}

/** Зміна у відсотках відносно попереднього значення; null, якщо порівнювати нема з чим */
export function pctChange(current: number, previous: number): number | null {
  return previous === 0 ? null : round1(((current - previous) / Math.abs(previous)) * 100);
}

/** Маржа: яка частина доходу залишається прибутком, у відсотках; null, якщо доходу нема */
export function margin({ income, profit }: Pick<Totals, 'income' | 'profit'>): number | null {
  return income > 0 ? round1((profit / income) * 100) : null;
}

// ---- періоди ('YYYY-MM', 'YYYY' або 'all' — увесь час) ----

const pad = (n: number) => String(n).padStart(2, '0');

export type ParsedPeriod = {
  kind: 'month' | 'year' | 'all';
  key: string;
  /** Межі дат як рядки ISO: from <= date < to (порівняння рядків працює для YYYY-MM-DD й використовує індекс) */
  from: string;
  to: string;
};

export function parsePeriod(key: string): ParsedPeriod | null {
  // Увесь час: межі ширші за будь-яку дату запису
  if (key === 'all') return { kind: 'all', key, from: '0000-01-01', to: '9999-12-31' };
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) {
    const y = Number(month[1]);
    const m = Number(month[2]);
    if (y < 1980 || y > 2100 || m < 1 || m > 12) return null;
    return { kind: 'month', key, from: `${key}-01`, to: `${shiftMonth(key, 1)}-01` };
  }
  const year = /^(\d{4})$/.exec(key);
  if (year) {
    const y = Number(year[1]);
    if (y < 1980 || y > 2100) return null;
    return { kind: 'year', key, from: `${y}-01-01`, to: `${y + 1}-01-01` };
  }
  return null;
}

/** 'YYYY-MM' зі зсувом на delta місяців */
export function shiftMonth(ym: string, delta: number) {
  const total = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Попередній період для порівняння; для всього часу порівнювати нема з чим */
export function previousPeriod(p: ParsedPeriod): string | null {
  if (p.kind === 'all') return null;
  return p.kind === 'month' ? shiftMonth(p.key, -1) : String(Number(p.key) - 1);
}

/** Місяці для графіка: 12 місяців року або 6 місяців, що закінчуються вибраним */
export function seriesMonths(p: ParsedPeriod): string[] {
  // Для всього часу стовпчики будує allTimeBuckets
  if (p.kind === 'all') return [];
  return p.kind === 'year'
    ? Array.from({ length: 12 }, (_, i) => `${p.key}-${pad(i + 1)}`)
    : [5, 4, 3, 2, 1, 0].map((n) => shiftMonth(p.key, -n));
}

/** Скільки місяців ще вміщує графік; довша історія показується по роках */
export const MAX_MONTHLY_BARS = 18;

/**
 * Стовпчики графіка за весь час: місяці від першого запису до поточного, а якщо їх забагато для екрана, то роки.
 * Без записів лишається один порожній поточний місяць.
 */
export function allTimeBuckets(firstDate: string | undefined, now = new Date()): { unit: 'month' | 'year'; keys: string[] } {
  const last = currentMonth(now);
  const first = firstDate && firstDate.slice(0, 7) < last ? firstDate.slice(0, 7) : last;
  const months: string[] = [];
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m);
  if (months.length <= MAX_MONTHLY_BARS) return { unit: 'month', keys: months };
  const years: string[] = [];
  for (let y = Number(first.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) years.push(String(y));
  return { unit: 'year', keys: years };
}

export function currentMonth(now = new Date()) {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

// ---- зведення ----

export type MonthSum = { month: string; type: string; sum: number };

/** Заповнює місяці без записів нулями й складає доходи з витратами */
export function fillSeries(months: string[], rows: MonthSum[]): SeriesPoint[] {
  return months.map((month) => {
    const sum = (type: string) => rows.filter((r) => r.month === month && r.type === type).reduce((s, r) => s + r.sum, 0);
    return { month, ...totalsOf(sum('income'), sum('expense')) };
  });
}

/** Витрати за категоріями від більших до менших, з часткою у відсотках */
export function categoryShares(rows: { category: string; sum: number }[]): CategoryShare[] {
  const total = rows.reduce((s, r) => s + r.sum, 0);
  return rows
    .filter((r) => r.sum > 0)
    .map((r) => ({ category: r.category, amount: round2(r.sum), share: total ? round1((r.sum / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export type Overview = Totals & {
  /** Прибуток / вартість авто, % */
  roi: number;
  /** Початок володіння: найраніша з дати оренди й першого запису */
  since: string;
  monthsOwned: number;
  avgMonthly: number;
  /** Скільки витрат складає від доходів, %; null, якщо доходу нема */
  expenseShare: number | null;
  /** Скільки місяців до окупності: 0 — вже окупилось; null — вартість не вказана або авто не приносить прибутку */
  paybackMonths: number | null;
};

export function overviewOf(input: { price: number; income: number; expense: number; rentStart: string; firstRecord?: string; now?: Date }): Overview {
  const now = input.now ?? new Date();
  const t = totalsOf(input.income, input.expense);
  const since = [input.rentStart, input.firstRecord].filter((d): d is string => !!d).sort()[0];
  const monthsOwned = Math.max(
    1,
    (now.getUTCFullYear() - Number(since.slice(0, 4))) * 12 + now.getUTCMonth() - (Number(since.slice(5, 7)) - 1) + 1,
  );
  const avgMonthly = round2(t.profit / monthsOwned);
  const left = input.price - t.profit;
  const paybackMonths = input.price <= 0 ? null : left <= 0 ? 0 : avgMonthly > 0 ? Math.ceil(left / avgMonthly) : null;
  return {
    ...t,
    roi: input.price > 0 ? round1((t.profit / input.price) * 100) : 0,
    since,
    monthsOwned,
    avgMonthly,
    expenseShare: t.income > 0 ? round1((t.expense / t.income) * 100) : null,
    paybackMonths,
  };
}

/** Найкращий і найгірший місяць за прибутком; найгірший є лише якщо місяців більше одного */
export function bestWorst(months: { month: string; profit: number }[]) {
  if (!months.length) return { best: null, worst: null };
  const sorted = [...months].sort((a, b) => b.profit - a.profit);
  return { best: sorted[0], worst: sorted.length > 1 ? sorted[sorted.length - 1] : null };
}

// ---- облік орендаря ----

export type DealOverview = Totals & {
  /** Сплачено власнику за оренду авто (витрати з категорією «Оренда авто») */
  rentPaid: number;
  /** Скільки мало бути сплачено станом на сьогодні: ціна за добу × минулі доби */
  rentDue: number;
  /** rentDue − rentPaid: більше нуля — є борг, менше — переплата */
  rentBalance: number;
  /** Оренда за весь запланований період */
  plannedRent: number;
  /** Інші витрати: паливо, мийка, штрафи тощо */
  otherExpenses: number;
  elapsedDays: number;
  totalDays: number;
  /** Прибуток на добу оренди (доба рахується з першої) */
  avgProfitPerDay: number;
};

const MS_PER_DAY = 86_400_000;
const dayTime = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();
const calendarDays = (from: string, to: string) => Math.round((dayTime(to) - dayTime(from)) / MS_PER_DAY);

/** Показники однієї оренди для орендаря: що заробив, що витратив і як сплачує за авто */
export function dealOverviewOf(input: {
  pricePerDay: number;
  startDate: string;
  endDate: string;
  income: number;
  expense: number;
  rentPaid: number;
  /** YYYY-MM-DD; за замовчуванням сьогодні (UTC) */
  today?: string;
}): DealOverview {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const t = totalsOf(input.income, input.expense);
  const totalDays = Math.max(1, calendarDays(input.startDate, input.endDate));
  // Минулі доби: до початку — 0, під час оренди — скільки пройшло, після завершення — весь період
  const elapsedDays = Math.max(0, Math.min(totalDays, calendarDays(input.startDate, today)));
  const rentPaid = round2(input.rentPaid);
  const rentDue = round2(input.pricePerDay * elapsedDays);
  return {
    ...t,
    rentPaid,
    rentDue,
    rentBalance: round2(rentDue - rentPaid),
    plannedRent: round2(input.pricePerDay * totalDays),
    otherExpenses: round2(t.expense - rentPaid),
    elapsedDays,
    totalDays,
    avgProfitPerDay: round2(t.profit / Math.max(1, elapsedDays)),
  };
}
