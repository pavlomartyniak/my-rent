import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePhotos } from '../src/cars/photos';

describe('normalizePhotos', () => {
  it('галерея головна: обкладинка — її перше фото', () => {
    assert.deepEqual(normalizePhotos({ photos: ['a', 'b', 'c'], photoUri: 'zzz' }), { photos: ['a', 'b', 'c'], photoUri: 'a' });
  });
  it('порядок змінює обкладинку', () => {
    assert.equal(normalizePhotos({ photos: ['b', 'a'] }).photoUri, 'b');
  });
  it('порожня галерея очищає обкладинку', () => {
    assert.deepEqual(normalizePhotos({ photos: [] }), { photos: [], photoUri: '' });
  });
  it('старий клієнт із лише photoUri отримує галерею з одного фото', () => {
    assert.deepEqual(normalizePhotos({ photoUri: 'x' }), { photoUri: 'x', photos: ['x'] });
    assert.deepEqual(normalizePhotos({ photoUri: '' }), { photoUri: '', photos: [] });
  });
  it('без фото нічого не чіпає', () => {
    const dto = { brand: 'A' } as { photos?: string[]; photoUri?: string; brand: string };
    assert.deepEqual(normalizePhotos(dto), { brand: 'A' });
  });
  it('не змінює вхідний об’єкт', () => {
    const dto = { photos: ['a'] };
    normalizePhotos(dto);
    assert.deepEqual(dto, { photos: ['a'] });
  });
});
