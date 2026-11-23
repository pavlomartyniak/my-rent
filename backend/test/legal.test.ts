import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decryptText, encryptText } from '../src/common/crypto';
import { buildSections, buildTerms, type ContractParty } from '../src/contract/contract.terms';
import { EMPTY_LEGAL, legalComplete, legalProblems, normalizeLegal, partyLegal, seal, unseal } from '../src/legal/legal.data';

process.env.JWT_SECRET ||= 'test-secret';

/** РНОКПП для дати народження: 5 цифр днів від 31.12.1899, 4 цифри (остання непарна — чоловік) і контрольна цифра */
function taxFor(birth: string, serial = '1234') {
  const days = Math.round((Date.UTC(+birth.slice(0, 4), +birth.slice(5, 7) - 1, +birth.slice(8, 10)) - Date.UTC(1899, 11, 31)) / 86_400_000);
  const nine = `${days}${serial}`;
  const w = [-1, 5, 7, 9, 4, 6, 10, 5, 7];
  const sum = w.reduce((a, k, i) => a + k * Number(nine[i]), 0);
  return `${nine}${(((sum % 11) + 11) % 11) % 10}`;
}
const TAX = taxFor('1990-05-17');
const passport = normalizeLegal({ ...EMPTY_LEGAL, birthDate: '1990-05-17', taxId: TAX, docType: 'passport', docSeries: 'ac', docNumber: '482915', docIssuer: 'Галицьким РВ ЛМУ УМВС', docIssuedAt: '2010-06-01', region: 'Львівська область', city: 'Львів', street: 'Зелена', building: '5', apartment: '12', licenseNumber: 'ААА 123456', licenseIssuedAt: '2020-01-10', licenseValidUntil: '2099-01-10' });

describe('шифрування', () => {
  it('розшифровується назад і не містить відкритого тексту', () => {
    const packed = encryptText(TAX);
    assert.doesNotMatch(packed, new RegExp(TAX));
    assert.equal(decryptText(packed), TAX);
  });
  it('зіпсовані дані не розшифровуються', () => assert.equal(decryptText('v1.a.b.c'), null));
  it('seal/unseal зберігають дані', () => assert.deepEqual(unseal(seal(passport)), passport));
});

describe('перевірка даних для договору', () => {
  it('повні дані орендаря проходять', () => assert.deepEqual(legalProblems(passport, 'renter'), {}));
  it('власнику посвідчення водія не потрібне', () => assert.deepEqual(legalProblems({ ...passport, licenseNumber: '' }, 'owner'), {}));
  it('орендарю без посвідчення — помилка', () => assert.ok(legalProblems({ ...passport, licenseNumber: '' }, 'renter').licenseNumber));
  it('серія нормалізується до великих кириличних літер', () => assert.equal(passport.docSeries, 'АС'));
  it('РНОКПП — рівно 10 цифр', () => assert.ok(legalProblems({ ...passport, taxId: '123' }, 'owner').taxId));
  it('неповнолітні не можуть укладати договір', () => assert.ok(legalProblems({ ...passport, birthDate: `${new Date().getFullYear() - 10}-01-01` }, 'owner').birthDate));
  it('ID-картка: 9 цифр і орган з 4 цифр', () => {
    const id = normalizeLegal({ ...passport, docType: 'id', docNumber: '348291756', docIssuer: '5301', docIssuedAt: '2024-01-10', docValidUntil: '2099-01-01' });
    assert.deepEqual(legalProblems({ ...id, docValidUntil: '2033-01-10' }, 'owner'), {});
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

describe('правдоподібність даних', () => {
  it('РНОКПП з хибною контрольною цифрою відхиляється', () => assert.ok(legalProblems({ ...passport, taxId: `${TAX.slice(0, 9)}${(Number(TAX[9]) + 1) % 10}` }, 'owner').taxId));
  it('РНОКПП, що не збігається з датою народження, відхиляється', () => assert.match(legalProblems({ ...passport, birthDate: '1985-01-01' }, 'owner').taxId ?? '', /дат/));
  it('вигаданий номер паспорта (123456, 111111) відхиляється', () => {
    assert.ok(legalProblems({ ...passport, docNumber: '123456' }, 'owner').docNumber);
    assert.ok(legalProblems({ ...passport, docNumber: '111111' }, 'owner').docNumber);
  });
  it('латинська серія замінюється на кириличну', () => assert.equal(normalizeLegal({ ...passport, docSeries: 'AB' }).docSeries, 'АВ'));
  it('вулиця з випадкових літер відхиляється', () => assert.ok(legalProblems({ ...passport, street: 'Оллоиоолорррщжж' }, 'owner').street));
  it('без області, міста й вулиці адреса не приймається', () => {
    const p = legalProblems({ ...passport, region: '', city: '', street: '' }, 'owner');
    assert.ok(p.region && p.city && p.street);
  });
  it('номер будинку: цифри з літерою чи дробом, але не слова', () => {
    for (const ok of ['5', '12А', '7/2', '3-б']) assert.equal(legalProblems({ ...passport, building: ok }, 'owner').building, undefined, ok);
    for (const bad of ['', 'Б', 'будинок']) assert.ok(legalProblems({ ...passport, building: bad }, 'owner').building, bad);
  });
  it('адреса для договору складається з полів: тип вулиці не дублюється', () => {
    assert.equal(normalizeLegal({ ...passport, street: 'вул. Зелена' }).address, 'Львів, Львівська область, вул. Зелена, буд. 5, кв. 12');
    assert.equal(normalizeLegal({ ...passport, street: 'проспект Свободи', apartment: '' }).address, 'Львів, Львівська область, проспект Свободи, буд. 5');
  });
  it('документ не міг бути виданий до 14 років', () => assert.ok(legalProblems({ ...passport, docIssuedAt: '2000-01-01' }, 'owner').docIssuedAt));
  it('ID-картка не діє довше 10 років і не може бути протермінованою', () => {
    const id = normalizeLegal({ ...passport, docType: 'id', docNumber: '348291756', docIssuer: '5301', docIssuedAt: '2020-01-10', docValidUntil: '2040-01-10' });
    assert.ok(legalProblems(id, 'owner').docValidUntil);
    assert.match(legalProblems({ ...id, docValidUntil: '2021-01-10' }, 'owner').docValidUntil ?? '', /недійсн/);
  });
  it('посвідчення водія: формат ААА 123456, не раніше 18 років, не протерміноване', () => {
    assert.ok(legalProblems({ ...passport, licenseNumber: '12345' }, 'renter').licenseNumber);
    assert.ok(legalProblems({ ...passport, licenseIssuedAt: '2005-01-01' }, 'renter').licenseIssuedAt);
    assert.match(legalProblems({ ...passport, licenseValidUntil: '2021-01-01' }, 'renter').licenseValidUntil ?? '', /недійсн/);
  });
  it('номер посвідчення нормалізується: латинські літери стають кириличними, між серією й номером пробіл', () => {
    assert.equal(normalizeLegal({ ...passport, licenseNumber: 'AAA123456' }).licenseNumber, 'ААА 123456');
  });
});

describe('договір з даними сторін', () => {
  const base = { number: 'MR-1', createdAt: new Date('2026-11-12T10:00:00Z'), city: 'Львів', car: { title: 'Golf', brand: 'VW', model: 'Golf', year: 2011, vin: 'WVW', mileage: 1 }, startDate: '2026-11-20', endDate: '2026-11-30', pricePerDay: 1000 };
  const text = (o: ContractParty, r: ContractParty) => buildSections(buildTerms({ ...base, owner: o, renter: r })).flatMap((s) => s.paragraphs).join('\n');

  it('із даними немає рядків для вписування у блоці сторін і посвідченні', () => {
    const owner = { name: 'Власенко П. І.', phone: '+380501112233', legal: partyLegal(passport, 'owner') };
    const renter = { name: 'Тестова О. П.', phone: '+380509998877', legal: partyLegal(passport, 'renter') };
    const s = text(owner, renter);
    assert.match(s, new RegExp(`РНОКПП ${TAX}`));
    assert.match(s, /паспорт серія АС № 482915, виданий Галицьким РВ ЛМУ УМВС 01\.06\.2010/);
    assert.match(s, /посвідчення водія ААА 123456, видане 10\.01\.2020, дійсне до 10\.01\.2099/);
    assert.match(s, /\(ААА 123456, дійсне до 10\.01\.2099\) і не позбавлений/);
    assert.doesNotMatch(s.split('\n').filter((l) => /^Наймо|^Наймач/.test(l)).join('\n'), /_{3}/);
  });
  it('без даних лишаються рядки для вписування', () => {
    const s = text({ name: 'А', phone: '' }, { name: 'Б', phone: '' });
    assert.match(s, /РНОКПП _{12}/);
  });
});
