import type { Transaction } from '@/types';

/** Відповіді ендпоінтів /reports. Усі розрахунки робить сервер, застосунок лише показує. */

export type Totals = { income: number; expense: number; profit: number };
export type SeriesPoint = Totals & { month: string };
export type CategoryShare = { category: string; amount: number; share: number };

export type Overview = Totals & {
  /** Прибуток / вартість авто, % */
  roi: number;
  /** Початок володіння, YYYY-MM-DD */
  since: string;
  monthsOwned: number;
  avgMonthly: number;
  expenseShare: number | null;
  /** 0 — вже окупилось; null — вартість не вказана або авто не приносить прибутку */
  paybackMonths: number | null;
};

export type SummaryReport = {
  period: string;
  previousPeriod: string;
  totals: Totals & { margin: number | null };
  previous: Totals & { margin: number | null };
  /** Зміна відносно попереднього періоду, %; null — порівнювати нема з чим */
  change: { profit: number | null; income: number | null; expense: number | null; marginPoints: number | null };
  series: SeriesPoint[];
  categories: CategoryShare[];
  cars: { carId: string; period: Totals; overview: Overview }[];
};

export type MonthProfit = { month: string; profit: number };

export type CarReport = {
  carId: string;
  period: string;
  totals: Totals & { margin: number | null };
  series: SeriesPoint[];
  categories: CategoryShare[];
  allCategories: CategoryShare[];
  overview: Overview;
  years: (Totals & { year: string })[];
  best: MonthProfit | null;
  worst: MonthProfit | null;
};

/** Запис місяця зі звіту: разом з назвою авто, до якого він належить */
export type MonthEntry = Transaction & { car: string };

/** Один місяць історії: підсумок рахує сервер */
export type HistoryGroup = Totals & { month: string; items: Transaction[] };

/** Відповідь /transactions/history: найновіші місяці з підсумками та записами */
export type HistoryPage = { groups: HistoryGroup[]; hasMore: boolean; totalMonths: number };
