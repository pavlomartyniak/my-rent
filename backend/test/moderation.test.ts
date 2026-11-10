import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { counterpartIds, makeSnapshot, SNAPSHOT_MAX } from '../src/moderation/moderation.pure';

describe('знімок скарги', () => {
  it('прибирає переноси й зайві пробіли', () => assert.equal(makeSnapshot('  привіт\n\n  світ  '), 'привіт світ'));
  it('короткий текст лишає як є', () => assert.equal(makeSnapshot('текст'), 'текст'));
  it('довгий текст обрізає з крапками', () => {
    const out = makeSnapshot('а'.repeat(1000));
    assert.equal(out.length, SNAPSHOT_MAX);
    assert.ok(out.endsWith('…'));
  });
});

describe('блокування: з ким немає взаємодії', () => {
  const me = 'u1';
  it('повертає обидві сторони: кого заблокував я і хто заблокував мене', () => {
    const ids = counterpartIds(me, [
      { blockerId: 'u1', blockedId: 'u2' },
      { blockerId: 'u3', blockedId: 'u1' },
    ]);
    assert.deepEqual(ids.sort(), ['u2', 'u3']);
  });
  it('не дублює взаємні блокування', () => {
    const ids = counterpartIds(me, [
      { blockerId: 'u1', blockedId: 'u2' },
      { blockerId: 'u2', blockedId: 'u1' },
    ]);
    assert.deepEqual(ids, ['u2']);
  });
  it('без блокувань порожньо', () => assert.deepEqual(counterpartIds(me, []), []));
});
