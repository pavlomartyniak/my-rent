import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeSlot, listingAccess } from '../src/cars/listing-access';

const LIMIT = 2;

describe('доступ до публікації авто', () => {
  it('перше й друге авто власника публікуються безкоштовно', () => {
    assert.equal(listingAccess(undefined, 0, LIMIT), 'free');
    assert.equal(listingAccess(undefined, 1, LIMIT), 'free');
  });
  it('третє авто, коли обидва місця зайняті, потребує оплати', () => assert.equal(listingAccess(undefined, 2, LIMIT), 'payment'));
  it('безкоштовно відкрите авто можна публікувати знову', () => assert.equal(listingAccess('free', 2, LIMIT), 'unlocked'));
  it('оплачене авто можна публікувати знову без доплати', () => assert.equal(listingAccess('paid', 5, LIMIT), 'unlocked'));
  it('невідоме значення не відкриває публікацію', () => assert.equal(listingAccess('other', 2, LIMIT), 'payment'));
});

describe('безкоштовні місця', () => {
  it('віддає найменший вільний номер', () => {
    assert.equal(freeSlot([], LIMIT), 1);
    assert.equal(freeSlot([1], LIMIT), 2);
    assert.equal(freeSlot([2], LIMIT), 1); // перше звільнилось після видалення авто
  });
  it('усі місця зайняті — null', () => assert.equal(freeSlot([1, 2], LIMIT), null));
});
