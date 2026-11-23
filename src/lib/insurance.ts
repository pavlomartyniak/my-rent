import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';

import { openFileViewer } from './file-viewer';
import { mimeFor, postForm, serverMessage } from './upload';
import { ApiError, BASE_URL, getApiToken } from './api';

/** Відповідь /insurance/cars/:carId: чи є поліс і що про нього відомо */
export type PolicyInfo =
  | { canEdit: boolean; hasPolicy: false }
  | { canEdit: boolean; hasPolicy: true; name: string; mime: string; size: number; validUntil: string | null; expired: boolean; uploadedAt: string };

export const MAX_POLICY_BYTES = 8 * 1024 * 1024;

/** Вибраний файл полісу, який ще не завантажено на сервер */
export type PickedPolicy = { uri: string; name: string; mime?: string | null; size: number };

/** Вікно вибору файлу полісу (PDF чи фото); завеликий файл відхиляється з поясненням. null — нічого не вибрано */
export async function pickPolicy(): Promise<PickedPolicy | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if ((a.size ?? 0) > MAX_POLICY_BYTES) {
    Alert.alert('Файл завеликий', `Поліс має бути до ${MAX_POLICY_BYTES / 1024 / 1024} МБ. Стисніть файл чи завантажте фото.`);
    return null;
  }
  return { uri: a.uri, name: a.name, mime: a.mimeType, size: a.size ?? 0 };
}

/** Завантажує файл полісу на сервер (PDF чи фото); новий замінює попередній. Помилку сервера повертає як ApiError; `onProgress` — частка відправленого (0..1) */
export async function uploadPolicy(carId: string, file: { uri: string; name: string; mime?: string | null }, validUntil?: string | null, onProgress?: (fraction: number) => void): Promise<PolicyInfo> {
  const res = await postForm(`${BASE_URL}/insurance/cars/${carId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${getApiToken() ?? ''}` },
    fields: validUntil ? { validUntil } : {},
    file: { uri: file.uri, name: file.name, type: file.mime || mimeFor(file.name, 'application/pdf') },
    onProgress,
  });
  if (!res.ok) throw new ApiError(serverMessage(res.json) ?? 'Не вдалося завантажити поліс', res.status);
  return res.json as unknown as PolicyInfo;
}

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/**
 * Завантажує поліс із сервера (з токеном) у кеш пристрою й відкриває його у вбудованому переглядачі. Файл зберігається під фіксованою назвою з правильним розширенням: без розширення iOS не вміє його відкрити.
 */
export async function downloadPolicy(carId: string, mime: string) {
  const dir = new Directory(Paths.cache, 'insurance');
  dir.create({ idempotent: true });
  const target = new File(dir, `Страховий поліс.${EXT[mime] ?? 'pdf'}`);
  // Стара копія не заважає: завантажуємо наново
  if (target.exists) target.delete();
  // Звичайний запит, а не завантажувач: так видно справжню відповідь сервера (наприклад, «Власник ще не додав поліс»), а не битий файл
  const res = await fetch(`${BASE_URL}/insurance/cars/${carId}/file`, { headers: { Authorization: `Bearer ${getApiToken() ?? ''}` } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new Error(Array.isArray(body?.message) ? String(body?.message[0]) : (body?.message ?? `Помилка сервера (${res.status})`));
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new Error('Файл порожній');
  target.create({ overwrite: true });
  target.write(bytes);
  openFileViewer({ uri: target.uri, name: `Страховий поліс.${EXT[mime] ?? 'pdf'}`, mime });
}

/** Відкриває ще не завантажений файл полісу (з пристрою) для перегляду через системне вікно */
export async function viewPickedPolicy(file: { uri: string; mime?: string | null }) {
  openFileViewer({ uri: file.uri, name: 'Страховий поліс', mime: file.mime ?? 'application/pdf' });
}

/** Імена файлів, збережені з URL-кодуванням (%D0%9E…), показуємо читабельно */
export function readableName(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
