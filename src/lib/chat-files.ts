import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { openFileViewer } from './file-viewer';
import { mimeFor, postForm, serverMessage } from './upload';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { api, ApiError, BASE_URL, getApiToken } from './api';
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

const authHeader = () => ({ Authorization: `Bearer ${getApiToken() ?? ''}` });

/**
 * Завантажує вибране й повертає вкладення в тому ж порядку. Фото й відео йдуть напряму в Cloudinary за підписами сервера
 * (повертаються https-посилання), а файли — на наш сервер, як страховий поліс (повертається fileId): їх віддає лише сервер учасникам розмови.
 * `onProgress(i, f)` — частка відправленого (0..1) для вкладення з номером i; `signal` скасовує відправку.
 */
export async function uploadDrafts(drafts: Draft[], chatId: string, onProgress?: (index: number, fraction: number) => void, signal?: AbortSignal): Promise<Attachment[]> {
  const media = drafts.filter((d) => d.kind !== 'file');
  let sig: ChatSignature | null = null;
  if (media.length) {
    try {
      sig = await api<ChatSignature>('POST', '/media/chat-signature', { files: media.map((d) => ({ kind: d.kind })) });
    } catch (e) {
      throw new Error(e instanceof ApiError && e.status === 503 ? 'Фото й відео поки недоступні' : e instanceof ApiError ? e.message : 'Не вдалося підготувати завантаження');
    }
  }
  const out: Attachment[] = [];
  let m = 0;
  for (const [i, d] of drafts.entries()) {
    const file = { uri: d.uri, name: d.name, type: mimeFor(d.name, d.kind === 'image' ? 'image/jpeg' : d.kind === 'video' ? 'video/mp4' : 'application/octet-stream') };
    const report = (f: number) => onProgress?.(i, f);
    if (d.kind === 'file') {
      const res = await postForm(`${BASE_URL}/chats/${chatId}/files`, { headers: authHeader(), file, onProgress: report, signal });
      const fileId = (res.json as { fileId?: string } | null)?.fileId;
      if (!res.ok || !fileId) throw new Error(serverMessage(res.json) ?? `Не вдалося завантажити «${d.name}»`);
      out.push({ kind: 'file', url: '', name: d.name, size: d.size, fileId });
      continue;
    }
    const item = sig!.items[m++]!;
    const res = await postForm(item.uploadUrl, {
      fields: { api_key: sig!.apiKey, timestamp: String(item.timestamp), public_id: item.publicId, signature: item.signature },
      file,
      onProgress: report,
      signal,
    });
    const url = (res.json as { secure_url?: string } | null)?.secure_url;
    if (!res.ok || !url) throw new Error(((res.json as { error?: { message?: string } } | null)?.error?.message) ?? `Не вдалося завантажити «${d.name}»`);
    out.push({ kind: d.kind, url, name: d.name, size: d.size });
  }
  return out;
}

/** Завантажує файл із розмови (з токеном) у кеш пристрою й відкриває його у вбудованому переглядачі */
export async function downloadChatFile(chatId: string, fileId: string, name: string) {
  const res = await fetch(`${BASE_URL}/chats/${chatId}/files/${fileId}`, { headers: authHeader() });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new Error(Array.isArray(body?.message) ? String(body?.message[0]) : (body?.message ?? `Помилка сервера (${res.status})`));
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) throw new Error('Файл порожній');
  const dir = new Directory(Paths.cache, 'chat-files');
  dir.create({ idempotent: true });
  // Назва з розширенням: за ним система знає, чим відкрити файл
  const safe = name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'Файл';
  const target = new File(dir, `${fileId.slice(-6)}-${safe}`);
  if (target.exists) target.delete();
  target.create({ overwrite: true });
  target.write(bytes);
  openFileViewer({ uri: target.uri, name });
}

/** Постер відео: перший кадр із Cloudinary (для відео, що вже завантажене) */
export function videoPoster(url: string) {
  return url.includes('/video/upload/') ? url.replace('/video/upload/', '/video/upload/so_0,f_jpg,w_480/').replace(/\.[a-z0-9]+$/i, '.jpg') : undefined;
}
