import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canChange, type ConditionReport, handoverReady, missingSlots, permissions, REQUIRED_SLOTS } from '../src/condition/condition.rules';

const photo = (slot: string) => ({ id: slot, slot, url: `https://x/${slot}.jpg`, by: 'owner' as const, at: new Date() });
const full = (): ConditionReport => ({ photos: REQUIRED_SLOTS.map(photo), odometer: { km: 120000, by: 'owner', at: new Date() } });

describe('стан авто: готовність при передачі', () => {
  it('без фото й одометра звіт не готовий, відсутні всі обов’язкові слоти', () => {
    assert.equal(handoverReady(undefined), false);
    assert.deepEqual(missingSlots(undefined), [...REQUIRED_SLOTS]);
  });

  it('усі обов’язкові фото, але без одометра: не готово', () => {
    const r = full();
    delete r.odometer;
    assert.equal(missingSlots(r).length, 0);
    assert.equal(handoverReady(r), false);
  });

  it('усі обов’язкові фото й одометр: готово; додаткові слоти й пошкодження не потрібні', () => {
    assert.equal(handoverReady(full()), true);
  });

  it('нестачу видно по слотах', () => {
    const r = full();
    r.photos = r.photos.filter((p) => p.slot !== 'seatsRear' && p.slot !== 'left');
    assert.deepEqual(missingSlots(r), ['left', 'seatsRear']);
    assert.equal(handoverReady(r), false);
  });
});

describe('стан авто: що дозволено коли', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  const base = { startDate: '2026-11-20', endDate: '2026-12-20' };

  it('до активації фото при передачі можна змінювати', () => {
    const p = permissions({ ...base, status: 'awaiting' }, '2026-11-20', now);
    assert.equal(canChange('handover', 'front', p), true);
    assert.equal(canChange('return', 'front', p), false);
  });

  it('після активації передача заморожена, лише пошкодження протягом 48 годин', () => {
    const within = permissions({ ...base, status: 'active', contract: { signedAt: new Date('2026-11-20T10:00:00Z') } }, '2026-11-20', now);
    assert.equal(canChange('handover', 'front', within), false);
    assert.equal(canChange('handover', 'damage', within), true);
    const late = permissions({ ...base, status: 'active', contract: { signedAt: new Date('2026-11-17T10:00:00Z') } }, '2026-11-20', now);
    assert.equal(canChange('handover', 'damage', late), false);
  });

  it('повернення відкривається за добу до кінця й триває 14 днів після', () => {
    const open = (today: string) => permissions({ ...base, status: 'active', contract: { signedAt: new Date('2026-11-01T00:00:00Z') } }, today, now).returnEdit;
    assert.equal(open('2026-12-01'), false);
    assert.equal(open('2026-12-19'), true);
    assert.equal(open('2026-12-20'), true);
    assert.equal(open('2027-01-03'), true);
    assert.equal(open('2027-01-04'), false);
  });
});
