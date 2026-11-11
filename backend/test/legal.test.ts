import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { carProblems, identityProblems, legalProblems, licenseProblems, normalizeLicense, licenseCoversRental, normalizeCarLegal, normalizeLegal, plateValid, rnokppValid, type LegalProfile } from '../src/common/legal';

const TODAY = '2026-11-12';
// Вигадані дані; РНОКПП підібрано під контрольну суму
const good: LegalProfile = {
  partyType: 'individual',
  middleName: 'Петрович',
  rnokpp: '3000000008',
  idDoc: { type: 'id_card', series: '', number: '123456789', issuedBy: '1234', issuedAt: '2022-05-01' },
  address: 'м. Київ, вул. Хрещатик, 1, кв. 2',
  license: { series: 'ААА', number: '123456', categories: ['B'], validUntil: '2030-01-01' },
};

describe('РНОКПП', () => {
  it('перевіряє контрольну цифру', () => {
    const base = '300000000';
    const ok = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => rnokppValid(base + d));
    assert.equal(ok.length, 1, 'для основи рівно одна контрольна цифра');
    assert.ok(rnokppValid(good.rnokpp), good.rnokpp);
  });
  it('відкидає не 10 цифр', () => {
    for (const v of ['', '123', '12345678901', 'abcdefghij', '300000000a']) assert.equal(rnokppValid(v), false, v);
  });
});

describe('дані сторони', () => {
  it('повні дані орендаря приймаються', () => assert.deepEqual(legalProblems(good, { needLicense: true, today: TODAY }), []));
  it('власнику посвідчення не потрібне', () => assert.deepEqual(legalProblems({ ...good, license: undefined }, { needLicense: false, today: TODAY }), []));
  it('орендарю без посвідчення — помилка', () => assert.ok(legalProblems({ ...good, license: undefined }, { needLicense: true, today: TODAY }).length >= 2));
  it('порожніх даних немає', () => assert.deepEqual(legalProblems(undefined, { needLicense: false, today: TODAY }), ['Заповніть дані для договору']));
  it('ФОП без КВЕД — помилка, з КВЕД — ок', () => {
    assert.ok(legalProblems({ ...good, partyType: 'fop' }, { needLicense: false, today: TODAY }).some((e) => /КВЕД/.test(e)));
    assert.deepEqual(legalProblems({ ...good, partyType: 'fop', kved: '49.32' }, { needLicense: false, today: TODAY }), []);
    assert.ok(legalProblems({ ...good, partyType: 'fop', kved: '4932' }, { needLicense: false, today: TODAY }).some((e) => /КВЕД/.test(e)));
  });
  it('паспорт-книжка: серія й 6 цифр', () => {
    const book = { ...good, idDoc: { ...good.idDoc, type: 'passport_book' as const, series: 'аб', number: '123456' } };
    assert.deepEqual(legalProblems(book, { needLicense: false, today: TODAY }), []);
    assert.ok(legalProblems({ ...book, idDoc: { ...book.idDoc, number: '12345' } }, { needLicense: false, today: TODAY }).length);
    assert.ok(legalProblems({ ...book, idDoc: { ...book.idDoc, series: '1' } }, { needLicense: false, today: TODAY }).length);
  });
  it('дата видачі не з майбутнього', () => assert.ok(legalProblems({ ...good, idDoc: { ...good.idDoc, issuedAt: '2027-01-01' } }, { needLicense: false, today: TODAY }).length));
  it('нормалізація: пробіли, регістр, зайві поля', () => {
    const n = normalizeLegal({ ...good, rnokpp: ' 3000 000008 ', license: { series: 'а а', number: '12 34 56', categories: ['b', 'B', 'ce'], validUntil: '2030-01-01' }, extra: 'x' } as never);
    assert.equal(n.rnokpp, '3000000008');
    assert.deepEqual(n.license, { series: 'АА', number: '123456', categories: ['B', 'CE'], validUntil: '2030-01-01' });
    assert.ok(!('extra' in n));
    assert.ok(!('kved' in n));
  });
});

describe('посвідчення водія окремо від даних сторони', () => {
  const lic = { series: 'ААА', number: '123456', categories: ['B'], validUntil: '2030-01-01' };
  it('порожнє посвідчення — undefined, а не об’єкт із порожніми полями', () => {
    assert.equal(normalizeLicense(undefined), undefined);
    assert.equal(normalizeLicense({ series: '', number: '', categories: [], validUntil: '' }), undefined);
  });
  it('повне посвідчення без помилок, порожнє — усі чотири пункти', () => {
    assert.deepEqual(licenseProblems(lic, TODAY), []);
    assert.equal(licenseProblems(undefined, TODAY).length, 4);
  });
  it('дані сторони без посвідчення проходять перевірку особи', () => {
    const { license: _l, ...noLicense } = good;
    assert.deepEqual(identityProblems(noLicense as LegalProfile, TODAY), []);
    assert.deepEqual(legalProblems(noLicense as LegalProfile, { needLicense: false, today: TODAY }), []);
    assert.equal(legalProblems(noLicense as LegalProfile, { needLicense: true, today: TODAY }).length, 4);
  });
  it('legal лише з посвідченням (після реєстрації): особа не заповнена, посвідчення є', () => {
    const onlyLicense = { license: lic } as unknown as LegalProfile;
    assert.deepEqual(identityProblems(onlyLicense, TODAY), ['Заповніть дані для договору']);
    assert.deepEqual(licenseProblems(onlyLicense.license, TODAY), []);
  });
});

describe('посвідчення водія', () => {
  const withLicense = (license: object) => ({ ...good, license: license as never });
  const lic = { series: 'ААА', number: '123456', categories: ['B'], validUntil: '2030-01-01' };
  it('без строку дії — помилка', () => assert.ok(legalProblems(withLicense({ ...lic, validUntil: '' }), { needLicense: true, today: TODAY }).some((e) => /до якої дати/.test(e))));
  it('хибна дата — помилка', () => assert.ok(legalProblems(withLicense({ ...lic, validUntil: 'скоро' }), { needLicense: true, today: TODAY }).some((e) => /до якої дати/.test(e))));
  it('прострочене — помилка, діє до сьогодні включно — ок', () => {
    assert.ok(legalProblems(withLicense({ ...lic, validUntil: '2026-11-11' }), { needLicense: true, today: TODAY }).some((e) => /прострочено/.test(e)));
    assert.deepEqual(legalProblems(withLicense({ ...lic, validUntil: TODAY }), { needLicense: true, today: TODAY }), []);
  });
  it('власнику строк дії не потрібен', () => assert.deepEqual(legalProblems({ ...good, license: undefined }, { needLicense: false, today: TODAY }), []));
  it('посвідчення має діяти до кінця оренди', () => {
    assert.equal(licenseCoversRental(withLicense(lic), '2030-01-01'), null);
    assert.ok(/діє до 01\.01\.2030, а оренда закінчується 02\.01\.2030/.test(licenseCoversRental(withLicense(lic), '2030-01-02')!));
    assert.equal(licenseCoversRental(undefined, '2030-01-02'), null);
  });
});

describe('дані авто', () => {
  const full = { plate: 'AA 1234 BB', regCertificate: 'ТЕХ 123456', color: 'сірий' };
  it('нормалізація', () => assert.deepEqual(normalizeCarLegal({ plate: 'aa 1234 bb', regCertificate: 'тех 123456', color: ' сірий ' }), { plate: 'AA1234BB', regCertificate: 'ТЕХ123456', color: 'сірий' }));
  it('повні дані приймаються', () => assert.deepEqual(carProblems(full), []));
  it('порожні дані: номер, свідоцтво, колір', () => assert.equal(carProblems({}).length, 3));
  it('хибне свідоцтво', () => assert.equal(carProblems({ ...full, regCertificate: '123' }).length, 1));
  it('державний номер: нормалізація й перевірка', () => {
    for (const ok of ['AA1234BB', 'aa 1234 bb', 'КА 1234 ВН', 'AB-1234-CD']) assert.equal(plateValid(ok), true, ok);
    for (const bad of ['', '   ', 'A1', '###$$$']) assert.equal(plateValid(bad), false, bad);
  });
});
