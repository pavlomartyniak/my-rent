import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Types } from 'mongoose';

import { buildSections } from '../src/contract/contract.terms';
import { newDealData } from '../src/deals/deal-factory';

const base = () => ({
  owner: { firstName: 'Олег', lastName: 'Коваль', middleName: 'Іванович', phone: '+380501112233' },
  renter: { firstName: 'Іра', lastName: 'Мельник', middleName: 'Петрівна', phone: '+380509998877' },
  ownerId: new Types.ObjectId(),
  renterId: new Types.ObjectId(),
  carId: new Types.ObjectId(),
  title: 'Golf 2011',
  city: 'Львів',
  pricePerDay: 850,
  startDate: '2030-01-10',
  endDate: '2030-02-10',
  source: 'request' as const,
  sourceId: new Types.ObjectId(),
});
const car = { brand: 'Volkswagen', model: 'Golf', year: 2011, vin: 'WVWZZZ1KZBW000000', mileage: 245000 };

describe('оренда з оголошення: вимога фотозвіту', () => {
  it('без вимоги в оголошенні звіт не вмикається', () => {
    const d = newDealData({ ...base(), car });
    assert.equal(d.contract.terms.checkin, undefined);
    assert.equal('checkin' in d, false);
  });

  it('вимога з оголошення потрапляє в договір і налаштування оренди', () => {
    const d = newDealData({ ...base(), car: { ...car, listing: { checkin: { every: 'weekly', weekday: 1, body: true, interior: false } } } });
    assert.deepEqual(d.contract.terms.checkin, { every: 'weekly', weekday: 1, body: true, interior: false });
    assert.equal(d.checkin?.settings.enabled, true);
    assert.equal(d.checkin?.settings.every, 'weekly');
    assert.equal(d.checkin?.settings.weekday, 1);
    assert.match(buildSections(d.contract.terms).map((s) => s.paragraphs.join(' ')).join(' '), /звіт/);
  });
});
