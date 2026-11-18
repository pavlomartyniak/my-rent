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
