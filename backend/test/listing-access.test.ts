import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listingAccess } from '../src/cars/listing-access';

describe('доступ до публікації авто', () => {
  it('перше авто власника публікується безкоштовно', () => assert.equal(listingAccess(undefined, false), 'free'));
  it('друге авто, поки перше займає безкоштовне місце, потребує оплати', () => assert.equal(listingAccess(undefined, true), 'payment'));
  it('безкоштовно відкрите авто можна публікувати знову', () => assert.equal(listingAccess('free', true), 'unlocked'));
  it('оплачене авто можна публікувати знову без доплати', () => assert.equal(listingAccess('paid', true), 'unlocked'));
  it('невідоме значення не відкриває публікацію', () => assert.equal(listingAccess('other', true), 'payment'));
});
