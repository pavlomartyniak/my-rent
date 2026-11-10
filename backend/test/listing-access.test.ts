import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeSlot, listingAccess, releaseListingSlot } from '../src/cars/listing-access';

const LIMIT = 3;

describe('доступ до публікації авто', () => {
  it('перші три авто власника можна публікувати', () => {
    assert.equal(listingAccess(undefined, 0, LIMIT), 'free');
    assert.equal(listingAccess(undefined, 1, LIMIT), 'free');
    assert.equal(listingAccess(undefined, 2, LIMIT), 'free');
  });
  it('четверте авто, коли всі три місця зайняті, не публікується (ліміт бета-версії)', () => assert.equal(listingAccess(undefined, 3, LIMIT), 'limit'));
  it('авто, що вже займає місце, можна публікувати знову', () => assert.equal(listingAccess('free', 3, LIMIT), 'unlocked'));
  it('застаріле значення paid теж лишає публікацію відкритою', () => assert.equal(listingAccess('paid', 5, LIMIT), 'unlocked'));
  it('невідоме значення не відкриває публікацію', () => assert.equal(listingAccess('other', 3, LIMIT), 'limit'));
});

describe('місця для публікації', () => {
  it('віддає найменший вільний номер', () => {
    assert.equal(freeSlot([], LIMIT), 1);
    assert.equal(freeSlot([1], LIMIT), 2);
    assert.equal(freeSlot([1, 2], LIMIT), 3);
    assert.equal(freeSlot([2], LIMIT), 1); // перше звільнилось після видалення авто
  });
  it('усі місця зайняті — null', () => assert.equal(freeSlot([1, 2, 3], LIMIT), null));
});

describe('знімання з публікації', () => {
  it('звільняє місце: авто знову потребує місця для публікації', () => {
    const car = { listingUnlock: 'free', listingFreeSlot: 2 };
    releaseListingSlot(car);
    assert.equal(car.listingUnlock, undefined);
    assert.equal(car.listingFreeSlot, undefined);
    assert.equal(listingAccess(car.listingUnlock, 3, LIMIT), 'limit');
  });
});
