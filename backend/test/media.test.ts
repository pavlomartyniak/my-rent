import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { chunk, publicIdFromUrl } from '../src/media/cloudinary';
import { MediaService } from '../src/media/media.service';
import { signUpload } from '../src/media/signature';

const CLOUD = 'demo';
const url = (id: string, ext = 'jpg', extra = 'v1700000000/') => `https://res.cloudinary.com/${CLOUD}/image/upload/${extra}${id}.${ext}`;

describe('publicIdFromUrl', () => {
  it('дістає ідентифікатор із посилання з версією', () => assert.equal(publicIdFromUrl(url('my-rent/u1/abc123'), CLOUD), 'my-rent/u1/abc123'));
  it('пропускає перетворення перед версією', () => assert.equal(publicIdFromUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,w_800/v17/my-rent/u1/abc.jpg`, CLOUD), 'my-rent/u1/abc'));
  it('працює без версії', () => assert.equal(publicIdFromUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/my-rent/u1/abc.png`, CLOUD), 'my-rent/u1/abc'));
  it('ідентифікатор без папки теж працює', () => assert.equal(publicIdFromUrl(url('plainid'), CLOUD), 'plainid'));
  it('чужа хмара, локальні файли й порожнє — null', () => {
    assert.equal(publicIdFromUrl(url('my-rent/u1/a'), 'other'), null);
    assert.equal(publicIdFromUrl('file:///var/mobile/photo.jpg', CLOUD), null);
    assert.equal(publicIdFromUrl('https://example.com/a.jpg', CLOUD), null);
    assert.equal(publicIdFromUrl('', CLOUD), null);
    assert.equal(publicIdFromUrl(undefined, CLOUD), null);
  });
});

describe('chunk', () => {
  it('ділить на частини', () => assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]));
});

describe('signUpload з публічним ідентифікатором', () => {
  it('підпис залежить від public_id і часу', () => {
    const a = signUpload({ public_id: 'my-rent/u1/a', timestamp: 1 }, 's');
    assert.notEqual(a, signUpload({ public_id: 'my-rent/u1/b', timestamp: 1 }, 's'));
    assert.notEqual(a, signUpload({ public_id: 'my-rent/u1/a', timestamp: 2 }, 's'));
  });
});

// ---- MediaService із підміненими базою й Cloudinary ----

type Call = { method: string; url: string };
const calls: Call[] = [];
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  calls.length = 0;
});

/** Колекція, що завжди віддає задані документи (запит не розбираємо: перевіряємо логіку навколо нього) */
const fakeModel = (docs: unknown[]) => ({
  find: () => ({
    lean: () => ({ exec: async () => docs, cursor: () => (async function* () { yield* docs; })() }),
  }),
});

function setup(opts: { cars?: unknown[]; deals?: unknown[]; chats?: unknown[]; listing?: { public_id: string; created_at: string }[] } = {}) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input);
    calls.push({ method: init?.method ?? 'GET', url: u });
    if (init?.method === 'DELETE') {
      const ids = new URL(u).searchParams.getAll('public_ids[]');
      return new Response(JSON.stringify({ deleted: Object.fromEntries(ids.map((i) => [i, 'deleted'])) }), { status: 200 });
    }
    return new Response(JSON.stringify({ resources: opts.listing ?? [] }), { status: 200 });
  }) as typeof fetch;
  const config = { get: (k: string) => ({ CLOUDINARY_CLOUD_NAME: CLOUD, CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' })[k] };
  return new MediaService(config as never, fakeModel(opts.cars ?? []) as never, fakeModel(opts.deals ?? []) as never, fakeModel([]) as never, fakeModel([]) as never, fakeModel(opts.chats ?? []) as never);
}

const deletedIds = () => calls.filter((c) => c.method === 'DELETE').flatMap((c) => new URL(c.url).searchParams.getAll('public_ids[]'));

describe('MediaService.release', () => {
  it('видаляє фото, на які ніхто не посилається', async () => {
    const media = setup();
    assert.equal(await media.release([url('my-rent/u1/a'), url('my-rent/u1/b')]), 2);
    assert.deepEqual(deletedIds().sort(), ['my-rent/u1/a', 'my-rent/u1/b']);
  });

  it('не чіпає фото, яке ще є в оренді чи чаті', async () => {
    const used = url('my-rent/u1/a');
    const media = setup({ deals: [{ photoUri: used }], chats: [{ context: { photoUri: url('my-rent/u1/b') } }] });
    assert.equal(await media.release([used, url('my-rent/u1/b'), url('my-rent/u1/c')]), 1);
    assert.deepEqual(deletedIds(), ['my-rent/u1/c']);
  });

  it('не чіпає фото, яке досі є в іншому авто', async () => {
    const shared = url('my-rent/u1/a');
    const media = setup({ cars: [{ photoUri: shared, photos: [shared] }] });
    assert.equal(await media.release([shared]), 0);
    assert.equal(deletedIds().length, 0);
  });

  it('ігнорує локальні файли й чужі хмари, дублікати видаляє один раз', async () => {
    const media = setup();
    await media.release(['file:///x.jpg', url('my-rent/u1/a', 'jpg').replace(CLOUD, 'other'), url('my-rent/u1/a'), url('my-rent/u1/a'), undefined, null]);
    assert.deepEqual(deletedIds(), ['my-rent/u1/a']);
  });

  it('помилка Cloudinary не кидається назовні', async () => {
    const media = setup();
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as typeof fetch;
    assert.equal(await media.release([url('my-rent/u1/a')]), 0);
  });
});

describe('MediaService.discard', () => {
  it('видаляє лише з папки самого користувача', async () => {
    const media = setup();
    await media.discard('u1', [url('my-rent/u1/a'), url('my-rent/u2/b'), url('other/c')]);
    assert.deepEqual(deletedIds(), ['my-rent/u1/a']);
  });
});

describe('MediaService.sweep', () => {
  const old = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const fresh = new Date(Date.now() - 3_600_000).toISOString();

  it('видаляє лише старі фото без посилань', async () => {
    const media = setup({
      cars: [{ photoUri: url('my-rent/u1/kept'), photos: [url('my-rent/u1/kept')] }],
      listing: [
        { public_id: 'my-rent/u1/kept', created_at: old },
        { public_id: 'my-rent/u1/orphan-old', created_at: old },
        { public_id: 'my-rent/u1/orphan-fresh', created_at: fresh },
      ],
    });
    assert.equal(await media.sweep(), 1);
    assert.deepEqual(deletedIds(), ['my-rent/u1/orphan-old']);
    assert.ok(calls.find((c) => c.method === 'GET')!.url.includes('prefix=my-rent%2F'));
  });

  it('нічого не робить без налаштованого Cloudinary', async () => {
    setup();
    const media = new MediaService({ get: () => undefined } as never, fakeModel([]) as never, fakeModel([]) as never, fakeModel([]) as never, fakeModel([]) as never, fakeModel([]) as never);
    assert.equal(await media.sweep(), 0);
    assert.equal(calls.length, 0);
  });
});
