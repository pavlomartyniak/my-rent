/**
 * Приводить фото до єдиного вигляду: галерея `photos` є головною, обкладинка `photoUri` — її перше фото.
 * Старі клієнти надсилають лише `photoUri`, тоді галерея складається з нього одного.
 */
export function normalizePhotos<T extends { photos?: string[]; photoUri?: string }>(dto: T): T {
  if (dto.photos) return { ...dto, photos: dto.photos, photoUri: dto.photos[0] ?? '' };
  if (dto.photoUri !== undefined) return { ...dto, photos: dto.photoUri ? [dto.photoUri] : [] };
  return dto;
}

