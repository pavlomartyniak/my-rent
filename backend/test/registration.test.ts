import { phoneKey } from '../src/common/profile';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BadRequestException, HttpException } from '@nestjs/common';

import { AuthService } from '../src/auth/auth.service';

type Doc = Record<string, unknown> & { _id: number; email: string; attempts: number; sentAt: Date; sends: number; windowStart: Date; expiresAt: Date; codeHash: string };

/** Мінімальна заміна колекції очікуваних реєстрацій у пам'яті */
function fakePending() {
  const docs: Doc[] = [];
  let id = 0;
  const match = (d: Doc, q: Record<string, unknown>) => Object.entries(q).every(([k, v]) => d[k] === v);
  const exec = <T>(v: T) => ({ exec: async () => v });
  return {
    docs,
    findOne: (q: Record<string, unknown>) => exec(docs.find((d) => match(d, q)) ?? null),
    updateOne: async (q: Record<string, unknown>, u: { $set?: Record<string, unknown>; $inc?: Record<string, number> }, o?: { upsert?: boolean }) => {
      let d = docs.find((x) => match(x, q));
      if (!d && o?.upsert) docs.push((d = { _id: ++id, ...q } as Doc));
      if (!d) return;
      Object.assign(d, u.$set ?? {});
      for (const [k, n] of Object.entries(u.$inc ?? {})) (d as Record<string, unknown>)[k] = ((d as Record<string, unknown>)[k] as number) + n;
    },
    findOneAndDelete: (q: Record<string, unknown>) => {
      const i = docs.findIndex((x) => match(x, q));
      return exec(i >= 0 ? docs.splice(i, 1)[0]! : null);
    },
  };
}

function setup(opts: { mailOk?: boolean; existingEmail?: string; takenPhone?: string } = {}) {
  const pending = fakePending();
  const created: Record<string, unknown>[] = [];
  const outbox: { to: string; text: string }[] = [];
  const users = {
    findByEmail: async (email: string) => (email === opts.existingEmail ? { id: 'u0' } : created.find((u) => u.email === email) ?? null),
    phoneTaken: async (phone: string) => !!opts.takenPhone && phoneKey(phone) === phoneKey(opts.takenPhone),
    create: async (data: Record<string, unknown>) => {
      const user = { id: `u${created.length + 1}`, role: data.role, ...data };
      created.push(user);
      return user;
    },
    toPublic: (u: unknown) => u,
  };
  const jwt = { signAsync: async () => 'token' };
  const state = { mailOk: opts.mailOk ?? true };
  const mail = { send: async (to: string, _s: string, text: string) => (outbox.push({ to, text }), state.mailOk) };
  const config = { get: () => undefined };
  const auth = new AuthService(users as never, jwt as never, mail as never, config as never, pending as never);
  const lastCode = () => /(\d{6})/.exec(outbox.at(-1)!.text)![1]!;
  return { auth, pending, created, outbox, lastCode, state };
}

const form = { email: 'Ivan@Example.com', password: 'password123', firstName: 'Іван', lastName: 'Шевченко', phone: '+380671234567', role: 'renter' };

describe('реєстрація з підтвердженням пошти', () => {
  it('після форми акаунта ще немає, а код іде на пошту', async () => {
    const { auth, created, outbox } = setup();
    await auth.register(form);
    assert.equal(created.length, 0);
    assert.equal(outbox[0]!.to, 'ivan@example.com');
  });

  it('правильний код створює акаунт із даними форми й одразу входить', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register(form);
    const res = await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.equal(res.token, 'token');
    assert.equal(created.length, 1);
    assert.equal(created[0]!.email, 'ivan@example.com');
    assert.equal(created[0]!.role, 'renter');
    assert.equal(created[0]!.firstName, 'Іван');
    assert.notEqual(created[0]!.passwordHash, form.password);
  });

  it('код одноразовий', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register(form);
    const code = lastCode();
    await auth.verifyRegistration({ email: form.email, code });
    await assert.rejects(auth.verifyRegistration({ email: form.email, code }), /Спершу заповніть форму/);
    assert.equal(created.length, 1);
  });

  it('хибний код не створює акаунт, а після п’яти спроб блокує навіть правильний', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register(form);
    const good = lastCode();
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(auth.verifyRegistration({ email: form.email, code: bad }), /Невірний код/);
    await assert.rejects(auth.verifyRegistration({ email: form.email, code: good }), /Забагато невдалих спроб/);
    assert.equal(created.length, 0);
  });

  it('прострочений код не приймається', async () => {
    const { auth, pending, lastCode } = setup();
    await auth.register(form);
    pending.docs[0]!.expiresAt = new Date(Date.now() - 1000);
    await assert.rejects(auth.verifyRegistration({ email: form.email, code: lastCode() }), /прострочено/);
  });

  it('код, надісланий на одну пошту, не підходить до іншої', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register(form);
    await auth.register({ ...form, email: 'other@example.com' });
    const otherCode = lastCode();
    await assert.rejects(auth.verifyRegistration({ email: form.email, code: otherCode }), /Невірний код/);
    assert.equal(created.length, 0);
  });

  it('посвідчення при реєстрації орендаря необов’язкове: без нього акаунт створюється без нього', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register({ ...form, role: 'renter' });
    await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.equal(created.length, 1);
    assert.ok(!('legal' in created[0]!));
  });

  it('повне чинне посвідчення зберігається в профілі після підтвердження пошти', async () => {
    const { auth, created, lastCode } = setup();
    const license = { series: 'ааа', number: '123456', categories: ['b'], validUntil: '2099-01-01' };
    await auth.register({ ...form, role: 'renter', license });
    await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.deepEqual((created[0] as { legal: unknown }).legal, { license: { series: 'ААА', number: '123456', categories: ['B'], validUntil: '2099-01-01' } });
  });

  it('частково заповнене чи прострочене посвідчення відхиляється до надсилання листа', async () => {
    const { auth, outbox } = setup();
    await assert.rejects(auth.register({ ...form, role: 'renter', license: { number: '123456' } }), (e: unknown) => e instanceof BadRequestException);
    await assert.rejects(auth.register({ ...form, role: 'renter', license: { series: 'ААА', number: '123456', categories: ['B'], validUntil: '2020-01-01' } }), (e: unknown) => e instanceof BadRequestException && /прострочено/.test(JSON.stringify(e.getResponse())));
    assert.equal(outbox.length, 0);
  });

  it('власнику посвідчення не потрібне: якщо воно прийшло, його ігнорують', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register({ ...form, role: 'owner', license: { number: 'x' } });
    await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.ok(!('legal' in created[0]!));
  });

  it('зайнята пошта відхиляється до надсилання листа', async () => {
    const { auth, outbox } = setup({ existingEmail: 'ivan@example.com' });
    await assert.rejects(auth.register(form), /уже існує/);
    assert.equal(outbox.length, 0);
  });

  it('зайнятий номер (в іншому записі) відхиляється до надсилання листа', async () => {
    const { auth, outbox } = setup({ takenPhone: '067 123 45 67' });
    await assert.rejects(auth.register(form), /номер телефону вже використовується/);
    assert.equal(outbox.length, 0);
  });

  it('повторний код раніше ніж через хвилину не надсилається', async () => {
    const { auth } = setup();
    await auth.register(form);
    await assert.rejects(auth.resendRegistration(form.email), (e: unknown) => e instanceof HttpException && e.getStatus() === 429);
    await assert.rejects(auth.register(form), (e: unknown) => e instanceof HttpException && e.getStatus() === 429);
  });

  it('після хвилини код можна надіслати ще раз, і працює лише новий', async () => {
    const { auth, pending, outbox, created, lastCode } = setup();
    await auth.register(form);
    const first = lastCode();
    pending.docs[0]!.sentAt = new Date(Date.now() - 61_000);
    await auth.resendRegistration(form.email);
    const second = lastCode();
    assert.equal(outbox.length, 2);
    if (first !== second) await assert.rejects(auth.verifyRegistration({ email: form.email, code: first }), /Невірний код/);
    await auth.verifyRegistration({ email: form.email, code: second });
    assert.equal(created.length, 1);
  });

  it('не більше п’яти листів на годину', async () => {
    const { auth, pending } = setup();
    for (let i = 0; i < 5; i++) {
      await (i === 0 ? auth.register(form) : auth.resendRegistration(form.email));
      pending.docs[0]!.sentAt = new Date(Date.now() - 61_000);
    }
    await assert.rejects(auth.resendRegistration(form.email), /Забагато запитів/);
  });

  it('якщо лист не пішов, повертається помилка', async () => {
    const { auth } = setup({ mailOk: false });
    await assert.rejects(auth.register(form), (e: unknown) => e instanceof HttpException && e.getStatus() === 503);
  });

  it('після невдалої відправки повторити можна одразу, а не чекати хвилину', async () => {
    const { auth, state, created, lastCode } = setup({ mailOk: false });
    await assert.rejects(auth.register(form), (e: unknown) => e instanceof HttpException && e.getStatus() === 503);
    state.mailOk = true; // пошту налаштували
    await auth.register(form); // без 429 «Код уже надіслано»
    await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.equal(created.length, 1);
  });

  it('невдалі відправки не з’їдають годинний ліміт листів', async () => {
    const { auth, state, pending } = setup({ mailOk: false });
    for (let i = 0; i < 7; i++) await assert.rejects(auth.register(form), (e: unknown) => e instanceof HttpException && e.getStatus() === 503);
    state.mailOk = true;
    await auth.register(form);
    assert.equal(pending.docs[0]!.sends, 1);
  });

  it('повторне надсилання без форми — помилка', async () => {
    const { auth } = setup();
    await assert.rejects(auth.resendRegistration('nobody@example.com'), /Спершу заповніть форму/);
  });
});
