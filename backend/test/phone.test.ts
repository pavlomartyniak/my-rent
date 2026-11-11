import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { phoneKey } from '../src/common/profile';

describe('phoneKey', () => {
  it('різні записи одного українського номера збігаються', () => {
    const key = '380671234567';
    for (const v of ['+380671234567', '067 123 45 67', '0671234567', '380 (67) 123-45-67', '+38 (067) 123-45-67', '00380671234567', '671234567']) {
      assert.equal(phoneKey(v), key, v);
    }
  });
  it('різні номери не збігаються', () => assert.notEqual(phoneKey('+380671234567'), phoneKey('+380671234568')));
  it('чужі номери лишаються цифрами з кодом країни', () => assert.equal(phoneKey('+1 (415) 555-0100'), '14155550100'));
});
