import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { api, ApiError } from './api';
import type { Attachment } from './chat';

/** Вибраний файл, який ще не надіслано */
export type Draft = { id: string; kind: Attachment['kind']; uri: string; name: string; size: number };

export const MAX_FILES = 5;
const MB = 1024 * 1024;
/** Ліміти розміру за видом; сервер перевіряє те саме */
export const MAX_BYTES: Record<Attachment['kind'], number> = { image: 10 * MB, file: 10 * MB, video: 50 * MB };

const kindOf = (mime?: string | null): Attachment['kind'] => (mime?.startsWith('image/') ? 'image' : mime?.startsWith('video/') ? 'video' : 'file');
let counter = 0;
const draftId = () => `${Date.now()}-${counter++}`;

/** Розмір у людському вигляді: «2,4 МБ» */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / MB).toFixed(1).replace('.', ',')} МБ`;
}

type Raw = { uri: string; name?: string | null; size?: number | null; mime?: string | null };

/** Перетворює вибране на чернетки, відкидаючи завеликі файли з поясненням; `room` — скільки ще можна додати */
function toDrafts(items: Raw[], room: number): Draft[] {
  const out: Draft[] = [];
  const tooBig: string[] = [];
  for (const it of items.slice(0, room)) {
    const kind = kindOf(it.mime);
    const size = it.size ?? 0;
    const fallback = kind === 'image' ? 'Фото.jpg' : kind === 'video' ? 'Відео.mp4' : 'Файл';
    const name = it.name || fallback;
    if (size > MAX_BYTES[kind]) tooBig.push(`${name} (${formatSize(size)})`);
    else out.push({ id: draftId(), kind, uri: it.uri, name, size });
  }
  if (items.length > room) Alert.alert('Забагато файлів', `За раз можна додати до ${MAX_FILES} вкладень.`);
  if (tooBig.length) Alert.alert('Файл завеликий', `${tooBig.join(', ')}. Ліміт: фото й файли до ${MAX_BYTES.image / MB} МБ, відео до ${MAX_BYTES.video / MB} МБ.`);
  return out;
}

export async function pickFromLibrary(room: number): Promise<Draft[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7, videoMaxDuration: 600 });
  if (res.canceled) return [];
  return toDrafts(res.assets.map((a) => ({ uri: a.uri, name: a.fileName, size: a.fileSize, mime: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg') })), room);
}

export async function pickFromCamera(room: number): Promise<Draft[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Немає доступу до камери', 'Дозвольте камеру для застосунку в налаштуваннях телефону.');
    return [];
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 120 });
  if (res.canceled) return [];
  return toDrafts(res.assets.map((a) => ({ uri: a.uri, name: a.fileName, size: a.fileSize, mime: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg') })), room);
}

export async function pickDocuments(room: number): Promise<Draft[]> {
  const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return toDrafts(res.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size, mime: a.mimeType })), room);
}

type ChatSignature = { cloudName: string; apiKey: string; items: { publicId: string; timestamp: number; signature: string; uploadUrl: string }[] };

const extOf = (name: string) => /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase();

/** Завантажує вибрані файли напряму в Cloudinary за підписами сервера й повертає вкладення з https-посиланнями */
export async function uploadDrafts(drafts: Draft[]): Promise<Attachment[]> {
  let sig: ChatSignature;
  try {
    sig = await api<ChatSignature>('POST', '/media/chat-signature', { files: drafts.map((d) => ({ kind: d.kind, ...(d.kind === 'file' && extOf(d.name) ? { ext: extOf(d.name) } : {}) })) });
  } catch (e) {
    throw new Error(e instanceof ApiError && e.status === 503 ? 'Вкладення поки недоступні' : e instanceof ApiError ? e.message : 'Не вдалося підготувати завантаження');
  }
  const out: Attachment[] = [];
  for (const [i, d] of drafts.entries()) {
    const item = sig.items[i]!;
    const form = new FormData();
    form.append('file', new File(d.uri) as unknown as Blob);
    form.append('api_key', sig.apiKey);
    form.append('timestamp', String(item.timestamp));
    form.append('public_id', item.publicId);
    form.append('signature', item.signature);
    const res = await fetch(item.uploadUrl, { method: 'POST', body: form });
    const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
    if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message ?? `Не вдалося завантажити «${d.name}»`);
    out.push({ kind: d.kind, url: data.secure_url, name: d.name, size: d.size });
  }
  return out;
}

/** Постер відео: перший кадр із Cloudinary (для відео, що вже завантажене) */
export function videoPoster(url: string) {
  return url.includes('/video/upload/') ? url.replace('/video/upload/', '/video/upload/so_0,f_jpg,w_480/').replace(/\.[a-z0-9]+$/i, '.jpg') : undefined;
}
