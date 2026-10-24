import { File } from 'expo-file-system';

import { api, ApiError } from './api';

type Signature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
};

/** Помилка, коли на сервері не налаштований Cloudinary (503): тоді фото лишаються лише на пристрої */
export class UploadUnavailableError extends Error {}

async function getSignature(): Promise<Signature> {
  try {
    return await api<Signature>('POST', '/media/upload-signature');
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) throw new UploadUnavailableError();
    throw e;
  }
}

/**
 * Завантажує одне фото напряму в Cloudinary за підписом нашого сервера.
 * Глобальний fetch у SDK 57 — це expo/fetch: частиною FormData має бути справжній файл (`File`),
 * а не об'єкт {uri, name, type}, як було в старому React Native.
 */
async function uploadOne(sig: Signature, localUri: string): Promise<string> {
  const form = new FormData();
  form.append('file', new File(localUri) as unknown as Blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);

  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message ?? 'Не вдалося завантажити фото');
  return data.secure_url;
}

export type UploadResult = {
  /** https-посилання завантажених фото в тому ж порядку, що й вибрані (невдалі пропущено) */
  urls: string[];
  failed: number;
  /** Cloudinary не налаштований на сервері: нічого не завантажено */
  unavailable: boolean;
};

/** Завантажує кілька фото по черзі з одним підписом; помилка одного фото не зупиняє решту */
export async function uploadPhotos(localUris: string[], onProgress?: (done: number, total: number) => void): Promise<UploadResult> {
  let sig: Signature;
  try {
    sig = await getSignature();
  } catch (e) {
    if (e instanceof UploadUnavailableError) return { urls: [], failed: 0, unavailable: true };
    throw e;
  }

  const urls: string[] = [];
  let failed = 0;
  for (const [i, uri] of localUris.entries()) {
    onProgress?.(i, localUris.length);
    try {
      urls.push(await uploadOne(sig, uri));
    } catch {
      failed += 1;
    }
  }
  onProgress?.(localUris.length, localUris.length);
  return { urls, failed, unavailable: false };
}

/** Зменшена копія фото для списків: Cloudinary сам стискає й міняє розмір (f_auto, q_auto, ширина) */
export function thumbnailUrl(url: string | undefined | null, width = 800) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url ?? undefined;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
}
