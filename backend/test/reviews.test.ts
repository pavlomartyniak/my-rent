import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OWNER_TAGS, RENTER_TAGS, summarize, tagsFor } from '../src/common/reviews';

describe('рейтинг', () => {
  it('без оцінок: нуль і без середнього', () => {
    assert.deepEqual(summarize([]), { count: 0, avg: null, tags: [] });
  });

  it('середнє до десятих і три найчастіші теги', () => {
    const s = summarize([
      { rating: 5, tags: ['Чесний', 'Гнучкий'] },
      { rating: 4, tags: ['Чесний'] },
      { rating: 4, tags: ['Чесний', 'Чисте авто', 'Швидко відповідає'] },
    ]);
    assert.equal(s.count, 3);
    assert.equal(s.avg, 4.3);
    assert.equal(s.tags.length, 3);
    assert.deepEqual(s.tags[0], { tag: 'Чесний', count: 3 });
  });

  it('теги залежать від того, кого оцінюють', () => {
    assert.deepEqual([...tagsFor('owner')], [...OWNER_TAGS]);
    assert.deepEqual([...tagsFor('renter')], [...RENTER_TAGS]);
    assert.ok(!tagsFor('owner').includes('Платить вчасно'));
  });
});

describe('позначки профілю', () => {
  const now = new Date('2026-11-18T00:00:00Z');
  const none = { count: 0, avg: null, tags: [] };

  it('новий акаунт: лише «Новий на Kolo»', async () => {
    const { profileBadges } = await import('../src/common/reviews');
    assert.deepEqual(profileBadges({ completed: 0, rating: none, joinedAt: new Date('2026-11-10T00:00:00Z'), now }).map((b) => b.key), ['new']);
  });

  it('досвідчений із високим рейтингом, не новий', async () => {
    const { profileBadges } = await import('../src/common/reviews');
    const rating = { count: 4, avg: 4.8, tags: [] };
    assert.deepEqual(profileBadges({ completed: 5, rating, joinedAt: new Date('2025-01-01T00:00:00Z'), now }).map((b) => b.key), ['top', 'experienced']);
  });

  it('високий рейтинг потребує щонайменше трьох оцінок', async () => {
    const { profileBadges } = await import('../src/common/reviews');
    assert.deepEqual(profileBadges({ completed: 1, rating: { count: 2, avg: 5, tags: [] }, joinedAt: new Date('2025-01-01T00:00:00Z'), now }), []);
  });
});
