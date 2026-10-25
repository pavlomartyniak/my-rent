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
