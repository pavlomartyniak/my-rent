import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type ExportRow, sumsByCar, sumsOf } from '../src/export/export.types';

const row = (car: string, type: 'income' | 'expense', amount: number): ExportRow => ({ date: '2026-01-01', car, type, category: 'x', amount, driver: '', note: '' });

describe('підсумки експорту', () => {
  it('рахує дохід, витрати й прибуток із копійками без похибки', () => {
    const s = sumsOf([row('A', 'income', 0.1), row('A', 'income', 0.2), row('A', 'expense', 0.05)]);
    assert.deepEqual(s, { income: 0.3, expense: 0.05, profit: 0.25 });
  });
  it('групує за авто у порядку першої появи', () => {
    const g = sumsByCar([row('B', 'income', 10), row('A', 'expense', 4), row('B', 'expense', 3)]);
    assert.deepEqual(g.map((x) => x.car), ['B', 'A']);
    assert.equal(g[0].sums.profit, 7);
  });
  it('порожній список дає нулі', () => assert.deepEqual(sumsOf([]), { income: 0, expense: 0, profit: 0 }));
});
