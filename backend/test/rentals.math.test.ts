import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escapeRegex, normalize } from '../src/common/normalize';
import { fullName, maskedName, rentalDays, totalPrice, validateRange } from '../src/rentals/rentals.math';

describe('rentalDays / totalPrice', () => {
  it('різниця дат у добах', () => {
    assert.equal(rentalDays('2026-10-10', '2026-10-12'), 2);
    assert.equal(rentalDays('2026-10-28', '2026-11-02'), 5);
    assert.equal(rentalDays('2026-02-27', '2026-03-02'), 3);
  });
  it('той самий день — одна доба', () => assert.equal(rentalDays('2026-10-10', '2026-10-10'), 1));
  it('перехід на літній час не дає зайвої доби', () => assert.equal(rentalDays('2026-03-28', '2026-03-30'), 2));
  it('вартість = ціна × доби', () => {
    assert.equal(totalPrice(1200, '2026-10-10', '2026-10-13'), 3600);
    assert.equal(totalPrice(99.99, '2026-10-10', '2026-10-12'), 199.98);
  });
});

describe('validateRange', () => {
  const today = '2026-10-24';
  it('коректний діапазон', () => assert.equal(validateRange('2026-10-24', '2026-10-30', today), null));
  it('початок у минулому', () => assert.match(validateRange('2026-10-23', '2026-10-30', today)!, /минулому/));
  it('кінець раніше за початок', () => assert.match(validateRange('2026-11-05', '2026-11-01', today)!, /раніше/));
  it('понад рік', () => {
    assert.match(validateRange('2026-10-24', '2027-11-01', today)!, /365/);
    assert.equal(validateRange('2026-10-24', '2027-10-24', today), null);
  });
  it('неіснуюча дата й сміття', () => {
    assert.match(validateRange('2026-02-31', '2026-03-05', today)!, /формат/);
    assert.match(validateRange('abc', '2026-03-05', today)!, /формат/);
  });
});

describe('імена', () => {
  it('maskedName ховає прізвище', () => assert.equal(maskedName('Павло', 'Мартиняк'), 'Павло М.'));
  it('maskedName без прізвища', () => assert.equal(maskedName('Павло', ''), 'Павло'));
  it('fullName', () => {
    assert.equal(fullName(' Павло ', ' Мартиняк '), 'Павло Мартиняк');
    assert.equal(fullName('Павло', ''), 'Павло');
  });
});

describe('normalize / escapeRegex', () => {
  it('регістр і діакритика', () => {
    assert.equal(normalize('Škoda'), 'skoda');
    assert.equal(normalize('  Івано-Франківськ '), 'івано франківськ');
    assert.equal(normalize('Київ'), 'київ');
    assert.notEqual(normalize('Київ'), normalize('Киів'));
    assert.equal(normalize('Йорк'), 'йорк');
    assert.equal(normalize('Citroën'), 'citroen');
  });
  it('escapeRegex нейтралізує спецсимволи', () => {
    const rx = new RegExp(escapeRegex('a.b(c)*'));
    assert.ok(rx.test('xa.b(c)*y'));
    assert.ok(!rx.test('axb(c)'));
    assert.equal(escapeRegex('.*'), '\\.\\*');
  });
});
