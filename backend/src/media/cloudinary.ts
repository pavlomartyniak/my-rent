/** Префікс публічних ідентифікаторів наших фото: my-rent/<id користувача>/<випадковий рядок> */
export const MEDIA_PREFIX = 'my-rent/';

/** Фото старше за цей вік, на яке ніхто не посилається, вважається сиротою (завантажене, але не збережене) */
export const ORPHAN_GRACE_HOURS = 24;

export type CloudType = 'image' | 'video' | 'raw';

/**
 * Тип ресурсу й публічний ідентифікатор Cloudinary з посилання
 * https://res.cloudinary.com/<хмара>/<image|video|raw>/upload/[перетворення/][v123/]my-rent/<користувач>/<файл>.jpg.
 * Для image і video розширення в ідентифікатор не входить, для raw (файли) входить. Повертає null для чужих посилань і локальних файлів.
 */
export function cloudRefFromUrl(url: string | undefined | null, cloudName?: string): { type: CloudType; publicId: string } | null {
  if (!url) return null;
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(.+)$/.exec(url);
  if (!m) return null;
  if (cloudName && m[1] !== cloudName) return null;
  const type = m[2] as CloudType;
  const segments = m[3]!.split('/');
  // Перетворення (f_auto,q_auto,w_800) і версія (v1700000000) стоять перед ідентифікатором
  const version = segments.findIndex((s) => /^v\d+$/.test(s));
  const rest = version >= 0 ? segments.slice(version + 1) : segments.filter((s, i, all) => i >= all.length - 1 || !/^[a-z]{1,3}_[^/]+$/i.test(s));
  const last = rest.at(-1);
  if (!last) return null;
  if (type !== 'raw') rest[rest.length - 1] = last.replace(/\.[a-z0-9]+$/i, '');
  const publicId = rest.join('/');
  return publicId ? { type, publicId } : null;
}

/** Публічний ідентифікатор фото (image) з посилання; для відео й файлів — null (див. cloudRefFromUrl) */
export function publicIdFromUrl(url: string | undefined | null, cloudName?: string): string | null {
  const ref = cloudRefFromUrl(url, cloudName);
  return ref?.type === 'image' ? ref.publicId : null;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
