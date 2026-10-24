import { round2 } from '../reports/reports.math';

export type MonthRow = { month: string; type: string; sum: number };
export type MonthSubtotal = { month: string; income: number; expense: number; profit: number };
export type HistoryGroup<T> = MonthSubtotal & { items: T[] };

/** Підсумки по місяцях (від новіших до старіших) з рядків агрегації «місяць × тип» */
export function monthSubtotals(rows: MonthRow[]): MonthSubtotal[] {
  const months = [...new Set(rows.map((r) => r.month))].sort().reverse();
  return months.map((month) => {
    const sum = (type: string) => rows.filter((r) => r.month === month && r.type === type).reduce((s, r) => s + r.sum, 0);
    const income = round2(sum('income'));
    const expense = round2(sum('expense'));
    return { month, income, expense, profit: round2(income - expense) };
  });
}

/** Розкладає записи по вибраних місяцях, зберігаючи порядок записів усередині місяця */
export function groupByMonth<T extends { date: string }>(txs: T[], months: MonthSubtotal[]): HistoryGroup<T>[] {
  return months.map((m) => ({ ...m, items: txs.filter((t) => t.date.startsWith(m.month)) }));
}
