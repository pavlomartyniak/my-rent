import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanMessage, isRead, preview } from '../src/chat/chat.math';

describe('cleanMessage', () => {
  it('обрізає пробіли по краях', () => assert.equal(cleanMessage('  привіт  '), 'привіт'));
  it('порожнє й лише пробіли — null', () => {
    assert.equal(cleanMessage(''), null);
    assert.equal(cleanMessage('   \n\t '), null);
  });
  it('не рядок — null', () => {
    assert.equal(cleanMessage(undefined), null);
    assert.equal(cleanMessage(42), null);
    assert.equal(cleanMessage({}), null);
  });
  it('стискає довгі серії порожніх рядків і приводить переноси до \\n', () => {
    assert.equal(cleanMessage('a\r\n\r\n\r\n\r\nb'), 'a\n\nb');
  });
  it('лишає одиночні переноси й емодзі', () => assert.equal(cleanMessage('Ок 👍\nДо завтра'), 'Ок 👍\nДо завтра'));
});

describe('isRead', () => {
  const at = new Date('2026-10-25T10:00:00Z');
  it('прочитано, якщо співрозмовник відкривав чат після повідомлення', () => assert.equal(isRead(at, new Date('2026-10-25T10:00:01Z')), true));
  it('у момент повідомлення теж прочитано', () => assert.equal(isRead(at, new Date('2026-10-25T10:00:00Z')), true));
  it('не прочитано, якщо відкривав раніше', () => assert.equal(isRead(at, new Date('2026-10-25T09:59:59Z')), false));
  it('не прочитано, якщо ще не відкривав', () => {
    assert.equal(isRead(at, undefined), false);
    assert.equal(isRead(at, null), false);
  });
});

describe('preview', () => {
  it('коротке лишається як є', () => assert.equal(preview('Привіт'), 'Привіт'));
  it('прибирає переноси', () => assert.equal(preview('а\n\nб   в'), 'а б в'));
  it('довге обрізає з трикрапкою', () => {
    const p = preview('x'.repeat(300), 50);
    assert.equal(p.length, 50);
    assert.ok(p.endsWith('…'));
  });
});

import { acceptedMessage, offerMessage, requestMessage } from '../src/chat/auto-messages';

describe('автоповідомлення', () => {
  const base = { title: 'Skoda Octavia 2020', startDate: '2026-11-01', endDate: '2026-11-11', days: 10 };
  it('запит: авто, дати, строк і сума', () => {
    const t = requestMessage({ ...base, total: 12000 });
    for (const p of ['Skoda Octavia 2020', '01.11.2026', '11.11.2026', '10 діб', '12 000 грн']) assert.ok(t.includes(p), p);
  });
  it('запит: власне повідомлення орендаря додається окремим абзацом', () => assert.ok(requestMessage({ ...base, total: 1, note: '  Потрібен автомат  ' }).endsWith('\n\nПотрібен автомат')));
  it('запит: порожня примітка нічого не додає', () => assert.ok(!requestMessage({ ...base, total: 1, note: '   ' }).includes('\n\n')));
  it('пропозиція: ціна за добу й підсумок', () => {
    const t = offerMessage({ ...base, pricePerDay: 1200, total: 12000 });
    assert.ok(t.includes('1 200 грн за добу') && t.includes('разом 12 000 грн'));
  });
  it('прийняття: коли відкривається підписання (за добу до початку)', () => assert.ok(acceptedMessage({ startDate: '2026-11-01' }).includes('31.10.2026')));
  it('відмінювання діб', () => {
    assert.ok(requestMessage({ ...base, days: 1, total: 1 }).includes('1 доба'));
    assert.ok(requestMessage({ ...base, days: 3, total: 1 }).includes('3 доби'));
    assert.ok(requestMessage({ ...base, days: 12, total: 1 }).includes('12 діб'));
  });
});
