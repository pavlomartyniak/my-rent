/** Префікс публічних ідентифікаторів наших фото: my-rent/<id користувача>/<випадковий рядок> */
export const MEDIA_PREFIX = 'my-rent/';

/** Фото старше за цей вік, на яке ніхто не посилається, вважається сиротою (завантажене, але не збережене) */
export const ORPHAN_GRACE_HOURS = 24;

/**
 * Публічний ідентифікатор Cloudinary з посилання вигляду
 * https://res.cloudinary.com/<хмара>/image/upload/[перетворення/][v123/]my-rent/<користувач>/<файл>.jpg → my-rent/<користувач>/<файл>.
 * Повертає null для чужих посилань і локальних файлів.
 */
export function publicIdFromUrl(url: string | undefined | null, cloudName?: string): string | null {
  if (!url) return null;
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/.exec(url);
  if (!m) return null;
  if (cloudName && m[1] !== cloudName) return null;
  const segments = m[2]!.split('/');
  // Перетворення (f_auto,q_auto,w_800) і версія (v1700000000) стоять перед ідентифікатором
  const version = segments.findIndex((s) => /^v\d+$/.test(s));
  const rest = version >= 0 ? segments.slice(version + 1) : segments.filter((s, i, all) => i >= all.length - 1 || !/^[a-z]{1,3}_[^/]+$/i.test(s));
  const last = rest.at(-1);
  if (!last) return null;
  rest[rest.length - 1] = last.replace(/\.[a-z0-9]+$/i, '');
  const id = rest.join('/');
  return id || null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
