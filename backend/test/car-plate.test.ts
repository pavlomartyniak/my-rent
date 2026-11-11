import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeCarLegal, plateValid } from '../src/common/car-plate';

describe('дані авто', () => {
  it('нормалізація: номер у єдиному вигляді, колір обрізаний', () => assert.deepEqual(normalizeCarLegal({ plate: 'aa 1234 bb', color: ' сірий ' }), { plate: 'AA1234BB', color: 'сірий' }));
  it('колір необов’язковий', () => assert.deepEqual(normalizeCarLegal({ plate: 'AA1234BB' }), { plate: 'AA1234BB', color: '' }));
  it('державний номер: допустимі вигляди', () => {
    for (const ok of ['AA1234BB', 'aa 1234 bb', 'КА 1234 ВН', 'AB-1234-CD', 'ВС6348РС']) assert.equal(plateValid(ok), true, ok);
  });
  it('державний номер: хибні значення', () => {
    for (const bad of ['', '   ', 'A1', '###$$$', undefined, null]) assert.equal(plateValid(bad), false, String(bad));
  });
});
