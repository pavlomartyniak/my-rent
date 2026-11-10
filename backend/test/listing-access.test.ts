import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeSlot, listingAccess, releaseListingSlot } from '../src/cars/listing-access';

const LIMIT = 5;

describe('доступ до публікації авто', () => {
  it('перші п’ять авто власника можна публікувати', () => {
    for (const used of [0, 1, 2, 3, 4]) assert.equal(listingAccess(undefined, used, LIMIT), 'free');
  });
  it('шосте авто, коли всі п’ять місць зайняті, не публікується', () => assert.equal(listingAccess(undefined, 5, LIMIT), 'limit'));
  it('авто, що вже займає місце, можна публікувати знову', () => assert.equal(listingAccess('free', 5, LIMIT), 'unlocked'));
  it('застаріле значення paid теж лишає публікацію відкритою', () => assert.equal(listingAccess('paid', 9, LIMIT), 'unlocked'));
  it('невідоме значення не відкриває публікацію', () => assert.equal(listingAccess('other', 5, LIMIT), 'limit'));
});

describe('місця для публікації', () => {
  it('віддає найменший вільний номер', () => {
    assert.equal(freeSlot([], LIMIT), 1);
    assert.equal(freeSlot([1], LIMIT), 2);
    assert.equal(freeSlot([1, 2], LIMIT), 3);
    assert.equal(freeSlot([1, 2, 3, 4], LIMIT), 5);
    assert.equal(freeSlot([2], LIMIT), 1); // перше звільнилось після видалення авто
  });
  it('усі місця зайняті — null', () => assert.equal(freeSlot([1, 2, 3, 4, 5], LIMIT), null));
});

describe('знімання з публікації', () => {
  it('звільняє місце: авто знову потребує місця для публікації', () => {
    const car = { listingUnlock: 'free', listingFreeSlot: 2 };
    releaseListingSlot(car);
    assert.equal(car.listingUnlock, undefined);
    assert.equal(car.listingFreeSlot, undefined);
    assert.equal(listingAccess(car.listingUnlock, 5, LIMIT), 'limit');
  });
});
