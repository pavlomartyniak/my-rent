import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { effectiveAt, groundsFor, isEffective, receivedAt } from '../src/deals/withdrawal';

describe('відмова від договору: строки', () => {
  const at = new Date('2026-11-12T10:00:00Z');
  const h = (n: number) => new Date(at.getTime() + n * 3_600_000);
  it('без підтвердження доставки отримання через 12 год, розірвання ще через 12', () => {
    assert.equal(receivedAt({ at }).toISOString(), h(12).toISOString());
    assert.equal(effectiveAt({ at }).toISOString(), h(24).toISOString());
  });
  it('доставлено на пошту раніше — відлік від доставки', () => assert.equal(effectiveAt({ at, emailDeliveredAt: h(1) }).toISOString(), h(13).toISOString()));
  it('відкрито в застосунку — відлік від відкриття', () => assert.equal(effectiveAt({ at, emailDeliveredAt: h(1), readAt: h(0.5) }).toISOString(), h(12.5).toISOString()));
  it('пізня доставка не відкладає отримання понад 12 год', () => assert.equal(receivedAt({ at, emailDeliveredAt: h(30) }).toISOString(), h(12).toISOString()));
  it('isEffective', () => {
    assert.equal(isEffective({ at }, h(23)), false);
    assert.equal(isEffective({ at }, h(24)), true);
  });
  it('підстави окремо для власника й орендаря', () => {
    assert.ok(groundsFor('owner').includes('payment_overdue') && !groundsFor('owner').includes('car_unusable'));
    assert.ok(groundsFor('renter').includes('car_unusable') && !groundsFor('renter').includes('payment_overdue'));
  });
});
