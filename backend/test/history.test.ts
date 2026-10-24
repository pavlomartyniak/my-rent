import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupByMonth, monthSubtotals } from '../src/transactions/history';

describe('monthSubtotals', () => {
  it('місяці від новіших до старіших, прибуток = доходи − витрати', () => {
    const r = monthSubtotals([
      { month: '2026-08', type: 'income', sum: 10000 },
      { month: '2026-10', type: 'income', sum: 24000 },
      { month: '2026-10', type: 'expense', sum: 1000.5 },
      { month: '2026-09', type: 'expense', sum: 300 },
    ]);
    assert.deepEqual(r, [
      { month: '2026-10', income: 24000, expense: 1000.5, profit: 22999.5 },
      { month: '2026-09', income: 0, expense: 300, profit: -300 },
      { month: '2026-08', income: 10000, expense: 0, profit: 10000 },
    ]);
  });
  it('без записів — порожньо', () => assert.deepEqual(monthSubtotals([]), []));
});

describe('groupByMonth', () => {
  it('розкладає записи по місяцях і зберігає їхній порядок', () => {
    const months = monthSubtotals([
      { month: '2026-10', type: 'income', sum: 3 },
      { month: '2026-09', type: 'income', sum: 1 },
    ]);
    const txs = [
      { id: 'a', date: '2026-10-20' },
      { id: 'b', date: '2026-10-05' },
      { id: 'c', date: '2026-09-30' },
      { id: 'd', date: '2026-08-01' }, // місяць не вибрано — відкидається
    ];
    const g = groupByMonth(txs, months);
    assert.deepEqual(g.map((x) => [x.month, x.items.map((t) => t.id)]), [['2026-10', ['a', 'b']], ['2026-09', ['c']]]);
  });
});
