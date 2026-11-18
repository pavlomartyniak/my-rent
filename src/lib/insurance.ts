import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ApiError, BASE_URL, getApiToken } from './api';

/** Відповідь /insurance/cars/:carId: чи є поліс і що про нього відомо */
export type PolicyInfo =
  | { canEdit: boolean; hasPolicy: false }
  | { canEdit: boolean; hasPolicy: true; name: string; mime: string; size: number; validUntil: string | null; expired: boolean; uploadedAt: string };

export const MAX_POLICY_BYTES = 8 * 1024 * 1024;

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

/** Завантажує поліс із сервера (з токеном) у кеш пристрою й відкриває системне вікно «Поділитись»: звідти його можна переглянути, зберегти чи надіслати */
export async function downloadPolicy(carId: string, mime: string) {
  const dir = new Directory(Paths.cache, 'insurance');
  dir.create({ idempotent: true });
  // Стара копія не заважає: завантажуємо наново
  for (const item of dir.list()) if (item instanceof File) item.delete();
  const task = File.createDownloadTask(`${BASE_URL}/insurance/cars/${carId}/file`, dir, { headers: { Authorization: `Bearer ${getApiToken() ?? ''}` } });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Не вдалося завантажити файл');
  if (!(await Sharing.isAvailableAsync())) throw new Error('На цьому пристрої не можна поділитись файлом');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Страховий поліс' });
}
