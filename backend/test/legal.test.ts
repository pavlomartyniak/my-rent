import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decryptText, encryptText } from '../src/common/crypto';
import { buildSections, buildTerms, type ContractParty } from '../src/contract/contract.terms';
import { EMPTY_LEGAL, legalComplete, legalProblems, normalizeLegal, partyLegal, seal, unseal } from '../src/legal/legal.data';

process.env.JWT_SECRET ||= 'test-secret';

const passport = normalizeLegal({ ...EMPTY_LEGAL, birthDate: '1990-05-17', taxId: '3012345678', docType: 'passport', docSeries: 'ac', docNumber: '123456', docIssuer: 'Галицьким РВ ЛМУ УМВС', docIssuedAt: '2010-06-01', address: 'м. Львів, вул. Зелена, 5, кв. 12', licenseNumber: 'ААА 123456', licenseIssuedAt: '2020-01-10', licenseValidUntil: '2030-01-10' });

describe('шифрування', () => {
  it('розшифровується назад і не містить відкритого тексту', () => {
    const packed = encryptText('3012345678');
    assert.doesNotMatch(packed, /3012345678/);
    assert.equal(decryptText(packed), '3012345678');
  });
  it('зіпсовані дані не розшифровуються', () => assert.equal(decryptText('v1.a.b.c'), null));
  it('seal/unseal зберігають дані', () => assert.deepEqual(unseal(seal(passport)), passport));
});

describe('перевірка даних для договору', () => {
  it('повні дані орендаря проходять', () => assert.deepEqual(legalProblems(passport, 'renter'), {}));
  it('власнику посвідчення водія не потрібне', () => assert.deepEqual(legalProblems({ ...passport, licenseNumber: '' }, 'owner'), {}));
  it('орендарю без посвідчення — помилка', () => assert.ok(legalProblems({ ...passport, licenseNumber: '' }, 'renter').licenseNumber));
  it('серія нормалізується до великих літер', () => assert.equal(passport.docSeries, 'AC'));
  it('РНОКПП — рівно 10 цифр', () => assert.ok(legalProblems({ ...passport, taxId: '123' }, 'owner').taxId));
  it('неповнолітні не можуть укладати договір', () => assert.ok(legalProblems({ ...passport, birthDate: `${new Date().getFullYear() - 10}-01-01` }, 'owner').birthDate));
  it('ID-картка: 9 цифр і орган з 4 цифр', () => {
    const id = normalizeLegal({ ...passport, docType: 'id', docNumber: '123456789', docIssuer: '1234', docValidUntil: '2032-01-01' });
    assert.deepEqual(legalProblems(id, 'owner'), {});
    assert.ok(legalProblems({ ...id, docNumber: '12345' }, 'owner').docNumber);
  });
  it('довіреність власника вимагає номер, дату й хто посвідчив', () => {
    const p = legalProblems({ ...passport, ownership: 'proxy' }, 'owner');
    assert.ok(p.proxyNumber && p.proxyDate && p.proxyIssuer);
  });
  it('legalComplete', () => {
    assert.equal(legalComplete(seal(passport), 'renter'), true);
    assert.equal(legalComplete(undefined, 'renter'), false);
    assert.equal(legalComplete(seal({ ...passport, taxId: '' }), 'renter'), false);
  });
});

describe('договір з даними сторін', () => {
  const base = { number: 'MR-1', createdAt: new Date('2026-11-12T10:00:00Z'), city: 'Львів', car: { title: 'Golf', brand: 'VW', model: 'Golf', year: 2011, vin: 'WVW', mileage: 1 }, startDate: '2026-11-20', endDate: '2026-11-30', pricePerDay: 1000 };
  const text = (o: ContractParty, r: ContractParty) => buildSections(buildTerms({ ...base, owner: o, renter: r })).flatMap((s) => s.paragraphs).join('\n');

  it('із даними немає рядків для вписування у блоці сторін і посвідченні', () => {
    const owner = { name: 'Власенко П. І.', phone: '+380501112233', legal: partyLegal(passport, 'owner') };
    const renter = { name: 'Тестова О. П.', phone: '+380509998877', legal: partyLegal(passport, 'renter') };
    const s = text(owner, renter);
    assert.match(s, /РНОКПП 3012345678/);
    assert.match(s, /паспорт серія AC № 123456, виданий Галицьким РВ ЛМУ УМВС 01\.06\.2010/);
    assert.match(s, /посвідчення водія ААА 123456, видане 10\.01\.2020, дійсне до 10\.01\.2030/);
    assert.match(s, /\(ААА 123456, дійсне до 10\.01\.2030\) і не позбавлений/);
    assert.doesNotMatch(s.split('\n').filter((l) => /^Наймо|^Наймач/.test(l)).join('\n'), /_{3}/);
  });
  it('без даних лишаються рядки для вписування', () => {
    const s = text({ name: 'А', phone: '' }, { name: 'Б', phone: '' });
    assert.match(s, /РНОКПП _{12}/);
  });
});
