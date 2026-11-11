import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkCode, generateCode, hashCode, maskEmail, OTP_MAX_ATTEMPTS, OTP_MINUTES, OTP_RESEND_SECONDS, resendWait, type PendingCode } from '../src/contract/contract.otp';
import { methodLabel, SIGNING_METHOD_EMAIL_OTP, signContract } from '../src/contract/contract.signing';
import { buildSections, buildTerms, contractHash, TEMPLATE_VERSION } from '../src/contract/contract.terms';

const ctx = { dealId: 'deal1', role: 'renter', contractHash: 'abc' };
const now = new Date('2026-11-10T12:00:00Z');
const pending = (over: Partial<PendingCode> = {}, code = '123456'): PendingCode => ({ hash: hashCode(code, ctx.dealId, ctx.role, ctx.contractHash), expiresAt: new Date(now.getTime() + OTP_MINUTES * 60_000), attempts: 0, sentAt: now, ...over });

describe('код підтвердження підпису', () => {
  it('має шість цифр', () => {
    for (let i = 0; i < 50; i++) assert.match(generateCode(), /^\d{6}$/);
  });
  it('правильний код проходить', () => assert.deepEqual(checkCode(pending(), '123456', ctx, now), { ok: true }));
  it('хибний код не проходить і каже, скільки спроб лишилось', () => assert.deepEqual(checkCode(pending(), '000000', ctx, now), { ok: false, reason: 'wrong', attemptsLeft: OTP_MAX_ATTEMPTS - 1 }));
  it('без запиту коду — missing', () => assert.deepEqual(checkCode(undefined, '123456', ctx, now), { ok: false, reason: 'missing' }));
  it('прострочений код — expired', () => assert.deepEqual(checkCode(pending({ expiresAt: new Date(now.getTime() - 1000) }), '123456', ctx, now), { ok: false, reason: 'expired' }));
  it('після вичерпання спроб навіть правильний код не проходить', () => assert.deepEqual(checkCode(pending({ attempts: OTP_MAX_ATTEMPTS }), '123456', ctx, now), { ok: false, reason: 'locked' }));
  it('код від іншого договору чи іншої сторони не підходить', () => {
    assert.equal(checkCode(pending(), '123456', { ...ctx, contractHash: 'other' }, now).ok, false);
    assert.equal(checkCode(pending(), '123456', { ...ctx, role: 'owner' }, now).ok, false);
    assert.equal(checkCode(pending(), '123456', { ...ctx, dealId: 'deal2' }, now).ok, false);
  });
});

describe('повторне надсилання коду', () => {
  it('одразу після надсилання треба чекати', () => assert.equal(resendWait(pending(), now), OTP_RESEND_SECONDS));
  it('через хвилину можна знову', () => assert.equal(resendWait(pending(), new Date(now.getTime() + OTP_RESEND_SECONDS * 1000)), 0));
  it('без попереднього коду чекати не треба', () => assert.equal(resendWait(undefined, now), 0));
});

describe('maskEmail', () => {
  it('ховає ім’я, лишає домен', () => assert.equal(maskEmail('ivan.shevchenko@gmail.com'), 'i***@gmail.com'));
});

describe('підпис за кодом', () => {
  const at = new Date('2026-11-10T12:00:00Z');
  it('за замовчуванням метод — код з e-mail', () => assert.equal(signContract({ contractHash: 'h', userId: 'u1', role: 'owner', at }).method, SIGNING_METHOD_EMAIL_OTP));
  it('підписи мають людські назви, у тому числі старі', () => {
    assert.equal(methodLabel(SIGNING_METHOD_EMAIL_OTP), 'підтвердження кодом з e-mail');
    assert.equal(methodLabel('demo'), 'підтвердження в застосунку');
  });
});

describe('шаблон договору', () => {
  const input = {
    number: 'MR-1',
    createdAt: new Date('2026-10-25T10:00:00Z'),
    city: 'Львів',
    owner: { name: 'Петро Власенко', phone: '' },
    renter: { name: 'Олена Тестова', phone: '' },
    car: { title: 'Skoda Octavia 2020', brand: 'Skoda', model: 'Octavia', year: 2020, vin: '', mileage: 1 },
    startDate: '2026-11-01',
    endDate: '2026-11-11',
    pricePerDay: 1200,
  };
  const text = (t: ReturnType<typeof buildTerms>) => buildSections(t).flatMap((s) => s.paragraphs).join('\n');

  it('новий договір містить пункти про спосіб підписання', () => {
    const t = buildTerms(input);
    assert.equal(t.templateVersion, TEMPLATE_VERSION);
    assert.match(text(t), /простим електронним підписом/);
    assert.match(text(t), /одноразовим кодом/);
    assert.match(text(t), /паперову копію/);
  });
  it('договір версії 3 (як і 2) показує лише імена сторін: особисті дані застосунок не збирає', () => {
    const v3 = text({ ...buildTerms(input), templateVersion: 3 });
    assert.match(v3, /Орендодавець: Петро Власенко/);
    assert.doesNotMatch(v3, /РНОКПП|документ про особу|посвідчення водія/);
    assert.match(text({ ...buildTerms(input), templateVersion: 2 }), /Орендар: Олена Тестова/);
  });
  it('договір без версії читається за старим текстом, без нових пунктів', () => {
    const { templateVersion: _v, ...legacy } = buildTerms(input);
    assert.doesNotMatch(text(legacy), /простим електронним підписом/);
    assert.match(text(legacy), /8\.3\. Спори вирішуються/);
  });
  it('версія шаблону входить у відбиток', () => {
    const t = buildTerms(input);
    const { templateVersion: _v, ...legacy } = t;
    assert.notEqual(contractHash(t), contractHash(legacy));
  });
});
