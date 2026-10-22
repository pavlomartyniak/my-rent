import type { Car, Transaction } from '@/types';

import { monthKey } from './date';

export type Totals = { income: number; expense: number; profit: number };

export function totals(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, profit: income - expense };
}

/** `period` — 'YYYY-MM' або 'YYYY'; без нього береться весь час */
export function filterByPeriod(txs: Transaction[], period?: string) {
  return period ? txs.filter((t) => t.date.startsWith(period)) : txs;
}

export function roi(car: Car, txs: Transaction[]) {
  if (car.price <= 0) return 0;
  return (totals(txs.filter((t) => t.carId === car.id)).profit / car.price) * 100;
}

export type CarStat = { car: Car } & Totals & { roi: number };

export function carStats(cars: Car[], txs: Transaction[], period?: string): CarStat[] {
  const scoped = filterByPeriod(txs, period);
  return cars
    .map((car) => {
      const t = totals(scoped.filter((x) => x.carId === car.id));
      return {
        car,
        ...t,
        roi: car.price > 0 ? (t.profit / car.price) * 100 : 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export function monthlySeries(txs: Transaction[], months: string[]) {
  return months.map((m) => ({
    month: m,
    ...totals(txs.filter((t) => monthKey(t.date) === m)),
  }));
}

export type CategoryTotal = { category: string; amount: number };

export function expenseByCategory(txs: Transaction[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}
