import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HttpException } from '@nestjs/common';

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
    updateOne: async (q: Record<string, unknown>, u: { $set?: Record<string, unknown>; $inc?: { attempts?: number } }, o?: { upsert?: boolean }) => {
      let d = docs.find((x) => match(x, q));
      if (!d && o?.upsert) docs.push((d = { _id: ++id, ...q } as Doc));
      if (!d) return;
      Object.assign(d, u.$set ?? {});
      if (u.$inc?.attempts) d.attempts += u.$inc.attempts;
    },
    findOneAndDelete: (q: Record<string, unknown>) => {
      const i = docs.findIndex((x) => match(x, q));
      return exec(i >= 0 ? docs.splice(i, 1)[0]! : null);
    },
  };
}

function setup(opts: { mailOk?: boolean; existingEmail?: string } = {}) {
  const pending = fakePending();
  const created: Record<string, unknown>[] = [];
  const outbox: { to: string; text: string }[] = [];
  const users = {
    findByEmail: async (email: string) => (email === opts.existingEmail ? { id: 'u0' } : created.find((u) => u.email === email) ?? null),
    create: async (data: Record<string, unknown>) => {
      const user = { id: `u${created.length + 1}`, role: data.role, ...data };
      created.push(user);
      return user;
    },
    toPublic: (u: unknown) => u,
  };
  const jwt = { signAsync: async () => 'token' };
  const mail = { send: async (to: string, _s: string, text: string) => (outbox.push({ to, text }), opts.mailOk ?? true) };
  const config = { get: () => undefined };
  const auth = new AuthService(users as never, jwt as never, mail as never, config as never, pending as never);
  const lastCode = () => /(\d{6})/.exec(outbox.at(-1)!.text)![1]!;
  return { auth, pending, created, outbox, lastCode };
}

const form = { email: 'Pavlo@Example.com', password: 'password123', firstName: 'Павло', lastName: 'Мартиняк', phone: '', role: 'renter' };

describe('реєстрація з підтвердженням пошти', () => {
  it('після форми акаунта ще немає, а код іде на пошту', async () => {
    const { auth, created, outbox } = setup();
    await auth.register(form);
    assert.equal(created.length, 0);
    assert.equal(outbox[0]!.to, 'pavlo@example.com');
  });

  it('правильний код створює акаунт із даними форми й одразу входить', async () => {
    const { auth, created, lastCode } = setup();
    await auth.register(form);
    const res = await auth.verifyRegistration({ email: form.email, code: lastCode() });
    assert.equal(res.token, 'token');
    assert.equal(created.length, 1);
    assert.equal(created[0]!.email, 'pavlo@example.com');
    assert.equal(created[0]!.role, 'renter');
    assert.equal(created[0]!.firstName, 'Павло');
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

  it('зайнята пошта відхиляється до надсилання листа', async () => {
    const { auth, outbox } = setup({ existingEmail: 'pavlo@example.com' });
    await assert.rejects(auth.register(form), /уже існує/);
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

  it('повторне надсилання без форми — помилка', async () => {
    const { auth } = setup();
    await assert.rejects(auth.resendRegistration('nobody@example.com'), /Спершу заповніть форму/);
  });
});
