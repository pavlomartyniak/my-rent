import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allTimeBuckets,
  bestWorst,
  categoryShares,
  fillSeries,
  margin,
  overviewOf,
  parsePeriod,
  pctChange,
  previousPeriod,
  seriesMonths,
  shiftMonth,
  totalsOf,
} from '../src/reports/reports.math';

describe('totalsOf', () => {
  it('рахує прибуток і округлює до копійок', () => {
    assert.deepEqual(totalsOf(100.005, 40.1), { income: 100.01, expense: 40.1, profit: 59.9 });
  });
});

describe('pctChange', () => {
  it('зростання і спад', () => {
    assert.equal(pctChange(120, 100), 20);
    assert.equal(pctChange(80, 100), -20);
  });
  it('без попереднього значення — null', () => assert.equal(pctChange(50, 0), null));
  it('для від’ємних: менший збиток — це покращення', () => assert.equal(pctChange(-50, -100), 50));
  it('округлює до десятих', () => assert.equal(pctChange(101, 300), -66.3));
});

describe('margin', () => {
  it('частка прибутку в доході', () => assert.equal(margin({ income: 100000, profit: 25000 }), 25));
  it('без доходу — null', () => assert.equal(margin({ income: 0, profit: -500 }), null));
  it('при збитку від’ємна', () => assert.equal(margin({ income: 1000, profit: -500 }), -50));
});

describe('періоди', () => {
  it('shiftMonth переходить через рік', () => {
    assert.equal(shiftMonth('2026-01', -1), '2025-12');
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(shiftMonth('2026-10', -12), '2025-10');
  });
  it('parsePeriod: місяць', () => {
    assert.deepEqual(parsePeriod('2026-02'), { kind: 'month', key: '2026-02', from: '2026-02-01', to: '2026-03-01' });
    assert.equal(parsePeriod('2026-12')?.to, '2027-01-01');
  });
  it('parsePeriod: рік', () => {
    assert.deepEqual(parsePeriod('2026'), { kind: 'year', key: '2026', from: '2026-01-01', to: '2027-01-01' });
  });
  it('parsePeriod відхиляє сміття', () => {
    for (const bad of ['', '2026-13', '2026-00', '26-10', '2026-1', '1900', '3000', 'abc', '2026-10-01']) {
      assert.equal(parsePeriod(bad), null, bad);
    }
  });
  it('previousPeriod', () => {
    assert.equal(previousPeriod(parsePeriod('2026-01')!), '2025-12');
    assert.equal(previousPeriod(parsePeriod('2026')!), '2025');
  });
  it('seriesMonths: 6 місяців до вибраного, 12 для року', () => {
    assert.deepEqual(seriesMonths(parsePeriod('2026-02')!), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    assert.equal(seriesMonths(parsePeriod('2026')!).length, 12);
    assert.equal(seriesMonths(parsePeriod('2026')!)[11], '2026-12');
  });
});

describe('увесь час', () => {
  it('період all охоплює будь-які дати й не має попереднього', () => {
    const p = parsePeriod('all')!;
    assert.equal(p.kind, 'all');
    assert.ok(p.from < '1980-01-01' && p.to > '2100-12-31');
    assert.equal(previousPeriod(p), null);
  });
  const now = new Date('2026-10-31T10:00:00Z');
  it('до 18 місяців історії: стовпчики по місяцях від першого запису', () => {
    const b = allTimeBuckets('2025-06-12', now);
    assert.equal(b.unit, 'month');
    assert.equal(b.keys.length, 17);
    assert.deepEqual([b.keys[0], b.keys.at(-1)], ['2025-06', '2026-10']);
  });
  it('рівно 18 місяців ще по місяцях, 19 уже по роках', () => {
    assert.equal(allTimeBuckets('2025-05-01', now).unit, 'month'); // 2025-05 … 2026-10 = 18
    const years = allTimeBuckets('2025-04-01', now);
    assert.equal(years.unit, 'year');
    assert.deepEqual(years.keys, ['2025', '2026']);
  });
  it('довга історія: роки без пропусків', () => assert.deepEqual(allTimeBuckets('2023-02-01', now).keys, ['2023', '2024', '2025', '2026']));
  it('без записів — один поточний місяць', () => assert.deepEqual(allTimeBuckets(undefined, now), { unit: 'month', keys: ['2026-10'] }));
  it('перший запис у цьому місяці — один стовпчик', () => assert.deepEqual(allTimeBuckets('2026-10-03', now).keys, ['2026-10']));
  it('графік за весь час додає записи в стовпчики років', () => {
    const rows = [
      { month: '2025', type: 'income', sum: 100 },
      { month: '2026', type: 'income', sum: 50 },
      { month: '2026', type: 'expense', sum: 20 },
    ];
    assert.deepEqual(fillSeries(['2024', '2025', '2026'], rows).map((x) => x.profit), [0, 100, 30]);
  });
});

describe('fillSeries', () => {
  it('заповнює порожні місяці нулями й складає доходи та витрати', () => {
    const rows = [
      { month: '2026-01', type: 'income', sum: 1000 },
      { month: '2026-01', type: 'expense', sum: 300 },
      { month: '2026-03', type: 'expense', sum: 50 },
    ];
    assert.deepEqual(fillSeries(['2026-01', '2026-02', '2026-03'], rows), [
      { month: '2026-01', income: 1000, expense: 300, profit: 700 },
      { month: '2026-02', income: 0, expense: 0, profit: 0 },
      { month: '2026-03', income: 0, expense: 50, profit: -50 },
    ]);
  });
});

describe('categoryShares', () => {
  it('сортує за сумою й рахує частки', () => {
    const r = categoryShares([
      { category: 'ТО', sum: 100 },
      { category: 'Ремонт', sum: 300 },
      { category: 'Шини', sum: 0 },
    ]);
    assert.deepEqual(r, [
      { category: 'Ремонт', amount: 300, share: 75 },
      { category: 'ТО', amount: 100, share: 25 },
    ]);
  });
  it('порожньо без витрат', () => assert.deepEqual(categoryShares([]), []));
});

describe('overviewOf', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const base = { rentStart: '2026-01-03', firstRecord: '2026-01-05', now };

  it('10 місяців по 8 000 прибутку: окупність (800к−80к)/8к = 90 міс', () => {
    const o = overviewOf({ ...base, price: 800000, income: 100000, expense: 20000 });
    assert.equal(o.profit, 80000);
    assert.equal(o.monthsOwned, 10);
    assert.equal(o.avgMonthly, 8000);
    assert.equal(o.roi, 10);
    assert.equal(o.paybackMonths, 90);
    assert.equal(o.expenseShare, 20);
    assert.equal(o.since, '2026-01-03');
  });
  it('вже окупилось → 0', () => assert.equal(overviewOf({ ...base, price: 50000, income: 100000, expense: 20000 }).paybackMonths, 0));
  it('вартість не вказана → null, ROI 0', () => {
    const o = overviewOf({ ...base, price: 0, income: 100000, expense: 20000 });
    assert.equal(o.paybackMonths, null);
    assert.equal(o.roi, 0);
  });
  it('збиток → окупності немає', () => assert.equal(overviewOf({ ...base, price: 800000, income: 0, expense: 5000 }).paybackMonths, null));
  it('без записів: початок — дата оренди, мінімум 1 місяць', () => {
    const o = overviewOf({ rentStart: '2026-10-20', price: 1000, income: 0, expense: 0, now });
    assert.equal(o.monthsOwned, 1);
    assert.equal(o.expenseShare, null);
    assert.equal(o.paybackMonths, null);
  });
  it('початок — найраніша з дати оренди й першого запису', () => {
    assert.equal(overviewOf({ rentStart: '2026-05-01', firstRecord: '2026-02-10', price: 1, income: 1, expense: 0, now }).since, '2026-02-10');
  });
});

describe('bestWorst', () => {
  it('порожньо', () => assert.deepEqual(bestWorst([]), { best: null, worst: null }));
  it('один місяць — найгіршого нема', () => assert.deepEqual(bestWorst([{ month: '2026-01', profit: 5 }]), { best: { month: '2026-01', profit: 5 }, worst: null }));
  it('кілька місяців', () => {
    const r = bestWorst([{ month: 'a', profit: 3 }, { month: 'b', profit: 9 }, { month: 'c', profit: -2 }]);
    assert.equal(r.best?.month, 'b');
    assert.equal(r.worst?.month, 'c');
  });
});

import { dealOverviewOf } from '../src/reports/reports.math';

describe('dealOverviewOf', () => {
  const base = { pricePerDay: 1000, startDate: '2026-10-01', endDate: '2026-10-11' };

  it('оренда триває: боргу немає, коли сплачено за минулі доби', () => {
    const o = dealOverviewOf({ ...base, income: 12000, expense: 5500, rentPaid: 5000, today: '2026-10-06' });
    assert.equal(o.elapsedDays, 5);
    assert.equal(o.totalDays, 10);
    assert.equal(o.rentDue, 5000);
    assert.equal(o.rentBalance, 0);
    assert.equal(o.plannedRent, 10000);
    assert.equal(o.otherExpenses, 500);
    assert.equal(o.profit, 6500);
    assert.equal(o.avgProfitPerDay, 1300);
  });
  it('недоплата — додатний баланс, переплата — від’ємний', () => {
    assert.equal(dealOverviewOf({ ...base, income: 0, expense: 2000, rentPaid: 2000, today: '2026-10-06' }).rentBalance, 3000);
    assert.equal(dealOverviewOf({ ...base, income: 0, expense: 7000, rentPaid: 7000, today: '2026-10-06' }).rentBalance, -2000);
  });
  it('до початку оренди минулих діб нема', () => {
    const o = dealOverviewOf({ ...base, income: 0, expense: 0, rentPaid: 0, today: '2026-09-25' });
    assert.equal(o.elapsedDays, 0);
    assert.equal(o.rentDue, 0);
    assert.equal(o.avgProfitPerDay, 0);
  });
  it('після завершення: усі доби періоду, не більше', () => {
    const o = dealOverviewOf({ ...base, income: 20000, expense: 10000, rentPaid: 10000, today: '2026-12-01' });
    assert.equal(o.elapsedDays, 10);
    assert.equal(o.rentDue, 10000);
    assert.equal(o.rentBalance, 0);
    assert.equal(o.avgProfitPerDay, 1000);
  });
  it('оренда на одну добу (дата початку = дата завершення) — одна доба', () => {
    const o = dealOverviewOf({ pricePerDay: 800, startDate: '2026-10-10', endDate: '2026-10-10', income: 0, expense: 0, rentPaid: 0, today: '2026-10-20' });
    assert.equal(o.totalDays, 1);
    assert.equal(o.rentDue, 800);
  });
  it('збиток: прибуток від’ємний, на добу теж', () => {
    const o = dealOverviewOf({ ...base, income: 1000, expense: 4000, rentPaid: 3000, today: '2026-10-04' });
    assert.equal(o.profit, -3000);
    assert.equal(o.avgProfitPerDay, -1000);
  });
});
