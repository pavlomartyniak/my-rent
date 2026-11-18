import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';

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

/** Завантажує файл полісу на сервер (PDF чи фото); новий замінює попередній. Помилку сервера повертає як ApiError */
export async function uploadPolicy(carId: string, file: { uri: string; name: string; mime?: string | null }, validUntil?: string | null): Promise<PolicyInfo> {
  const form = new FormData();
  form.append('file', new File(file.uri) as unknown as Blob);
  if (validUntil) form.append('validUntil', validUntil);
  const res = await fetch(`${BASE_URL}/insurance/cars/${carId}`, { method: 'PUT', headers: { Authorization: `Bearer ${getApiToken() ?? ''}` }, body: form });
  const body = (await res.json().catch(() => null)) as (PolicyInfo & { message?: string | string[] }) | null;
  if (!res.ok) throw new ApiError(Array.isArray(body?.message) ? String(body?.message[0]) : (body?.message ?? 'Не вдалося завантажити поліс'), res.status);
  return body as PolicyInfo;
}

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
const UTI: Record<string, string> = { 'application/pdf': 'com.adobe.pdf', 'image/jpeg': 'public.jpeg', 'image/png': 'public.png', 'image/webp': 'org.webmproject.webp', 'image/heic': 'public.heic' };

/**
 * Завантажує поліс із сервера (з токеном) у кеш пристрою й відкриває системне вікно «Поділитись»: звідти його можна переглянути,
 * зберегти чи надіслати. Файл зберігається під фіксованою назвою з правильним розширенням: без розширення iOS не вміє його відкрити.
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
  const file = target;
  if (!(await Sharing.isAvailableAsync())) throw new Error('На цьому пристрої не можна поділитись файлом');
  await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: UTI[mime], dialogTitle: 'Страховий поліс' });
}
