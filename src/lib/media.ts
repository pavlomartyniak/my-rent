import { api, ApiError } from './api';
import { mimeFor, postForm } from './upload';

/** Підпис завантаження: з `items` кожне фото має свій публічний ідентифікатор (так сервер знає, чиє воно, і може його прибрати) */
type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
  items?: { publicId: string; timestamp: number; signature: string }[];
};

/** Помилка, коли на сервері не налаштований Cloudinary (503): тоді фото лишаються лише на пристрої */
export class UploadUnavailableError extends Error {}

async function getSignature(count: number, path = '/media/upload-signature'): Promise<Signature> {
  try {
    return await api<Signature>('POST', path, { count });
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) throw new UploadUnavailableError();
    throw e;
  }
}

/** Завантажує одне фото напряму в Cloudinary за підписом нашого сервера; `onProgress` — частка відправленого (0..1) */
async function uploadOne(sig: Signature, index: number, localUri: string, onProgress?: (fraction: number) => void): Promise<string> {
  const fields: Record<string, string> = { api_key: sig.apiKey };
  const item = sig.items?.[index];
  if (item) {
    // Власний ідентифікатор: за ним сервер знає, чиє фото, і може його прибрати
    Object.assign(fields, { timestamp: String(item.timestamp), public_id: item.publicId, signature: item.signature });
  } else {
    // Старий сервер без окремих підписів: фото йдуть в одну папку
    Object.assign(fields, { timestamp: String(sig.timestamp), folder: sig.folder, signature: sig.signature });
  }
  const name = localUri.split('/').pop() || 'photo.jpg';
  const res = await postForm(sig.uploadUrl, { fields, file: { uri: localUri, name, type: mimeFor(name, 'image/jpeg') }, onProgress });
  const url = (res.json as { secure_url?: string } | null)?.secure_url;
  if (!res.ok || !url) throw new Error(((res.json as { error?: { message?: string } } | null)?.error?.message) ?? 'Не вдалося завантажити фото');
  return url;
}

/** Завантажує фото профілю (доступне обом ролям); повертає https-посилання або null, якщо не вдалось чи хмара не налаштована */
export async function uploadAvatar(localUri: string, onProgress?: (fraction: number) => void): Promise<string | null> {
  try {
    const sig = await getSignature(1, '/media/avatar-signature');
    return await uploadOne(sig, 0, localUri, onProgress);
  } catch {
    return null;
  }
}

export type UploadResult = {
  /** https-посилання завантажених фото в тому ж порядку, що й вибрані (невдалі пропущено) */
  urls: string[];
  failed: number;
  /** Cloudinary не налаштований на сервері: нічого не завантажено */
  unavailable: boolean;
};

/** Завантажує кілька фото по черзі з одним підписом; помилка одного фото не зупиняє решту */
export async function uploadPhotos(localUris: string[], onProgress?: (done: number, total: number, fraction: number) => void): Promise<UploadResult> {
  let sig: Signature;
  try {
    sig = await getSignature(localUris.length);
  } catch (e) {
    if (e instanceof UploadUnavailableError) return { urls: [], failed: 0, unavailable: true };
    throw e;
  }

  const urls: string[] = [];
  let failed = 0;
  for (const [i, uri] of localUris.entries()) {
    onProgress?.(i, localUris.length, 0);
    try {
      urls.push(await uploadOne(sig, i, uri, (f) => onProgress?.(i, localUris.length, f)));
    } catch {
      failed += 1;
    }
  }
  onProgress?.(localUris.length, localUris.length, 1);
  return { urls, failed, unavailable: false };
}

/**
 * Просить сервер прибрати з хмари щойно завантажені фото, які користувач видалив із форми до збереження. Сервер видаляє лише
 * ті з них, що лежать у папці користувача й ніде не збережені. Помилки не показуємо: це прибирання, а не дія користувача.
 */
export function discardPhotos(urls: string[]) {
  const remote = urls.filter((u) => u.startsWith('https://res.cloudinary.com/'));
  if (!remote.length) return;
  api('POST', '/media/discard', { urls: remote }).catch(() => {});
}

/** Зменшена копія фото для списків: Cloudinary сам стискає й міняє розмір (f_auto, q_auto, ширина) */
export function thumbnailUrl(url: string | undefined | null, width = 800) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url ?? undefined;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
}
