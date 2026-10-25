import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { carMatches, wantedConditionsFor } from '../src/wanted/wanted.match';

const octavia = { brand: 'Skoda', model: 'Octavia' };

describe('carMatches', () => {
  it('марка й модель збігаються', () => assert.equal(carMatches({ brand: 'Skoda', model: 'Octavia' }, octavia), true));
  it('регістр не важливий', () => assert.equal(carMatches({ brand: 'skoda', model: 'OCTAVIA' }, octavia), true));
  it('будь-яка модель цієї марки', () => assert.equal(carMatches({ brand: 'Skoda', model: '' }, octavia), true));
  it('будь-яке авто', () => assert.equal(carMatches({ brand: '', model: '' }, octavia), true));
  it('інша марка не підходить', () => assert.equal(carMatches({ brand: 'Toyota', model: '' }, octavia), false));
  it('та сама марка, інша модель — ні', () => assert.equal(carMatches({ brand: 'Skoda', model: 'Fabia' }, octavia), false));
  it('кирилиця й діакритика нормалізуються', () => assert.equal(carMatches({ brand: 'Škoda', model: 'Octavia' }, octavia), true));
});

describe('wantedConditionsFor', () => {
  it('завжди включає «будь-яке авто»', () => assert.deepEqual(wantedConditionsFor([octavia])[0], { brand: '' }));
  it('додає «будь-яка модель марки» і точну пару', () => {
    const c = wantedConditionsFor([octavia, { brand: 'Skoda', model: 'Fabia' }]);
    // будь-яке + одна марка + дві пари
    assert.equal(c.length, 4);
    assert.ok(c.some((x) => 'model' in x && x.model === ''));
  });
  it('спеціальні символи в назві екрануються', () => {
    const c = wantedConditionsFor([{ brand: 'A+B', model: 'C(1)' }]);
    const pair = c[2] as { brand: { $regex: string }; model: { $regex: string } };
    assert.equal(pair.brand.$regex, '^A\\+B$');
    assert.equal(pair.model.$regex, '^C\\(1\\)$');
  });
});
