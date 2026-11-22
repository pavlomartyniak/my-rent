import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDays, checkinStatus, dueDates, requiredSlots, type CheckinState } from '../src/checkin/checkin.rules';

// 2026-11-02 — понеділок
const deal = { status: 'active', startDate: '2026-11-02', endDate: '2026-12-31' };
const settings = { enabled: true, every: 'weekly' as const, weekday: 1, body: true, interior: true, since: '2026-11-02' };

describe('dueDates', () => {
  it('щотижня: перший звіт через тиждень у той самий день тижня', () => {
    const d = dueDates('2026-11-02', '2026-11-30', { every: 'weekly', weekday: 1 });
    assert.deepEqual(d, ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });
  it('щотижня: інший день тижня не раніше ніж через тиждень', () => {
    const d = dueDates('2026-11-02', '2026-11-30', { every: 'weekly', weekday: 5 });
    assert.equal(d[0], '2026-11-13');
  });
  it('раз на два тижні', () => {
    const d = dueDates('2026-11-02', '2026-12-31', { every: 'biweekly', weekday: 1 });
    assert.deepEqual(d.slice(0, 3), ['2026-11-16', '2026-11-30', '2026-12-14']);
  });
  it('щомісяця: той самий день, а в коротких місяцях останній день', () => {
    const d = dueDates('2026-01-31', '2026-04-30', { every: 'monthly', weekday: 0 });
    assert.deepEqual(d, ['2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('не виходить за кінець оренди', () => {
    assert.deepEqual(dueDates('2026-11-02', '2026-11-08', { every: 'weekly', weekday: 1 }), []);
  });
});

describe('checkinStatus', () => {
  const st = (reports: CheckinState['reports'] = []): CheckinState => ({ settings, reports });
  it('вимкнений звіт: нічого не потрібно', () => {
    assert.equal(checkinStatus(deal, { settings: { ...settings, enabled: false } }, '2026-11-20').state, 'none');
  });
  it('неактивна оренда: нічого не потрібно', () => {
    assert.equal(checkinStatus({ ...deal, status: 'terminated' }, st(), '2026-11-20').state, 'none');
  });
  it('до строку далеко: upcoming', () => {
    assert.equal(checkinStatus(deal, st(), '2026-11-04').state, 'upcoming');
  });
  it('за добу до строку: open', () => {
    assert.equal(checkinStatus(deal, st(), '2026-11-08').state, 'open');
  });
  it('у день строку: open', () => {
    assert.equal(checkinStatus(deal, st(), '2026-11-09').state, 'open');
  });
  it('день після строку: overdue', () => {
    const s = checkinStatus(deal, st(), '2026-11-10');
    assert.equal(s.state, 'overdue');
    assert.equal(s.overdueDays, 1);
  });
  it('один звіт закриває свій строк і всі попередні', () => {
    const s = checkinStatus(deal, st([{ id: 'a', due: '2026-11-16', at: new Date(), km: 1, photos: [], by: 'r' }]), '2026-11-17');
    assert.equal(s.state, 'upcoming');
    assert.equal(s.due, '2026-11-23');
  });
  it('строки до вмикання не рахуються', () => {
    const s = checkinStatus(deal, { settings: { ...settings, since: '2026-11-20' } }, '2026-11-22');
    assert.equal(s.overdueCount, 0);
    assert.equal(s.due, '2026-11-23');
  });
});

describe('requiredSlots', () => {
  it('панель приладів обов’язкова завжди', () => {
    assert.deepEqual(requiredSlots({ body: false, interior: false }), ['dashboard']);
  });
  it('кузов і салон додають свої фото', () => {
    assert.equal(requiredSlots({ body: true, interior: true }).length, 7);
  });
});

describe('addDays', () => {
  it('додає дні через межу місяця', () => assert.equal(addDays('2026-11-30', 1), '2026-12-01'));
});
