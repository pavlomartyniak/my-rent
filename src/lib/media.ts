import { api, ApiError } from './api';

type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
};

/** Помилка, коли на сервері не налаштований Cloudinary (503): тоді фото лишається лише на пристрої */
export class UploadUnavailableError extends Error {}

/**
 * Завантажує фото з телефона в Cloudinary. Підпис видає наш сервер (секрет не залишає його),
 * сам файл іде напряму в Cloudinary. Повертає https-посилання на фото.
 */
export async function uploadPhoto(localUri: string): Promise<string> {
  let sig: Signature;
  try {
    sig = await api<Signature>('POST', '/media/upload-signature');
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) throw new UploadUnavailableError();
    throw e;
  }

  const form = new FormData();
  // У React Native файл передається як об'єкт {uri, name, type}
  form.append('file', { uri: localUri, name: 'car.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);

  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message ?? 'Не вдалося завантажити фото');
  }
  return data.secure_url;
}

/** Зменшена копія фото для списків: Cloudinary сам стискає й міняє розмір (f_auto, q_auto, ширина) */
export function thumbnailUrl(url: string | undefined | null, width = 800) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url ?? undefined;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
}
