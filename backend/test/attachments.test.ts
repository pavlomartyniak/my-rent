import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AttachmentError, attachmentsLabel, cleanName, MAX_ATTACHMENTS, parseAttachments } from '../src/chat/attachments';
import { cloudRefFromUrl } from '../src/media/cloudinary';

const CLOUD = 'demo';
const url = (type: string, id: string) => `https://res.cloudinary.com/${CLOUD}/${type}/upload/v1/${id}`;

describe('cloudRefFromUrl', () => {
  it('тип ресурсу й ідентифікатор: розширення лише в raw', () => {
    assert.deepEqual(cloudRefFromUrl(url('image', 'my-rent/u1/chat/a.jpg'), CLOUD), { type: 'image', publicId: 'my-rent/u1/chat/a' });
    assert.deepEqual(cloudRefFromUrl(url('video', 'my-rent/u1/chat/b.mp4'), CLOUD), { type: 'video', publicId: 'my-rent/u1/chat/b' });
    assert.deepEqual(cloudRefFromUrl(url('raw', 'my-rent/u1/chat/c.pdf'), CLOUD), { type: 'raw', publicId: 'my-rent/u1/chat/c.pdf' });
  });

  it('чужа хмара й сторонні посилання не приймаються', () => {
    assert.equal(cloudRefFromUrl(url('image', 'my-rent/u1/chat/a.jpg'), 'other'), null);
    assert.equal(cloudRefFromUrl('https://evil.example/a.jpg', CLOUD), null);
  });
});

describe('parseAttachments', () => {
  const ok = (type: string, name: string, size = 1000, id = 'my-rent/u1/chat/x') => ({ url: url(type, id), name, size });

  it('вид визначається за типом ресурсу: у хмарі лише фото й відео', () => {
    const [a, b] = parseAttachments([ok('image', 'a.jpg', 1, 'my-rent/u1/chat/a.jpg'), ok('video', 'b.mp4', 1, 'my-rent/u1/chat/b.mp4')], CLOUD, 'u1');
    assert.deepEqual([a!.kind, b!.kind], ['image', 'video']);
  });

  it('файли (raw) у хмарі не приймаються: вони йдуть через наш сервер', () => {
    assert.throws(() => parseAttachments([ok('raw', 'c.pdf', 1, 'my-rent/u1/chat/c.pdf')], CLOUD, 'u1'), AttachmentError);
  });

  it('лише з папки чату самого відправника', () => {
    assert.throws(() => parseAttachments([ok('image', 'a.jpg', 1, 'my-rent/u2/chat/a.jpg')], CLOUD, 'u1'), AttachmentError);
    assert.throws(() => parseAttachments([ok('image', 'a.jpg', 1, 'my-rent/u1/cars/a.jpg')], CLOUD, 'u1'), AttachmentError);
  });

  it('ліміти розміру й кількості, дублікати', () => {
    assert.throws(() => parseAttachments([ok('image', 'a.jpg', 11 * 1024 * 1024, 'my-rent/u1/chat/a.jpg')], CLOUD, 'u1'), AttachmentError);
    assert.doesNotThrow(() => parseAttachments([ok('video', 'a.mp4', 40 * 1024 * 1024, 'my-rent/u1/chat/a.mp4')], CLOUD, 'u1'));
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ok('image', 'a.jpg', 1, `my-rent/u1/chat/${i}.jpg`));
    assert.throws(() => parseAttachments(many, CLOUD, 'u1'), AttachmentError);
    const same = ok('image', 'a.jpg', 1, 'my-rent/u1/chat/s.jpg');
    assert.throws(() => parseAttachments([same, same], CLOUD, 'u1'), AttachmentError);
  });

  it('без хмари вкладення відхиляються, без вкладень порожній список', () => {
    assert.throws(() => parseAttachments([ok('image', 'a.jpg')], undefined, 'u1'), AttachmentError);
    assert.deepEqual(parseAttachments(undefined, CLOUD, 'u1'), []);
  });
});

describe('назви й підписи', () => {
  it('назва без шляхів і керівних символів', () => {
    assert.equal(cleanName('../../etc/passwd'), '.._.._etc_passwd');
    assert.equal(cleanName('  '), 'Файл');
    assert.equal(cleanName('a'.repeat(300)).length, 120);
  });

  it('підпис для списку чатів', () => {
    assert.equal(attachmentsLabel([]), '');
    assert.equal(attachmentsLabel([{ kind: 'image', url: 'u', name: 'a', size: 1 }]), 'Фото');
    assert.equal(attachmentsLabel([{ kind: 'video', url: 'u', name: 'a', size: 1 }]), 'Відео');
    assert.equal(attachmentsLabel([{ kind: 'file', url: 'u', name: 'Договір.pdf', size: 1 }]), 'Файл: Договір.pdf');
    assert.equal(attachmentsLabel([{ kind: 'file', url: 'u', name: 'a', size: 1 }, { kind: 'image', url: 'v', name: 'b', size: 1 }]), 'Вкладення (2)');
  });
});
