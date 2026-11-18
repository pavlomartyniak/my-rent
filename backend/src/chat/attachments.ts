import { cloudRefFromUrl, MEDIA_PREFIX } from '../media/cloudinary';

/**
 * Вкладення повідомлення: фото й відео лежать у хмарі (url), файли — у нашій базі (fileId), як страховий поліс: їх віддає лише
 * сервер учасникам розмови. Ліміти розміру за видом.
 */
export type AttachmentKind = 'image' | 'video' | 'file';
export type Attachment = { kind: AttachmentKind; url: string; name: string; size: number; fileId?: string };

export const MAX_ATTACHMENTS = 5;
export const MAX_BYTES: Record<AttachmentKind, number> = { image: 10 * 1024 * 1024, file: 10 * 1024 * 1024, video: 50 * 1024 * 1024 };

export class AttachmentError extends Error {}

const KIND_OF = { image: 'image', video: 'video' } as const;

/** Назва файлу без керівних символів і шляхів, до 120 символів */
export function cleanName(name: string) {
  const flat = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\\/]+/g, '_').replace(/\s+/g, ' ').trim();
  return (flat || 'Файл').slice(0, 120);
}

/**
 * Перевіряє вкладення від клієнта: посилання мають вести в нашу хмару, у папку чату самого відправника (інакше можна
 * підсунути чуже фото чи довільний сайт), вид визначається за типом ресурсу в посиланні, а розмір не перевищує ліміт.
 */
export function parseAttachments(list: { url?: string; name: string; size: number }[] | undefined, cloudName: string | undefined, senderId: string): Attachment[] {
  if (!list?.length) return [];
  if (list.length > MAX_ATTACHMENTS) throw new AttachmentError(`Можна додати до ${MAX_ATTACHMENTS} вкладень за раз`);
  if (!cloudName) throw new AttachmentError('Вкладення недоступні: хмара не налаштована');
  const seen = new Set<string>();
  return list.map((a) => {
    const ref = cloudRefFromUrl(a.url, cloudName);
    // У хмарі лише фото й відео; файли (raw) сюди не потрапляють: вони йдуть через наш сервер
    if (!a.url || !ref || !ref.publicId.startsWith(`${MEDIA_PREFIX}${senderId}/chat/`)) throw new AttachmentError('Невірне вкладення');
    if (seen.has(a.url)) throw new AttachmentError('Те саме вкладення додано двічі');
    seen.add(a.url);
    const kind = KIND_OF[ref.type as 'image' | 'video'];
    if (!kind) throw new AttachmentError('Невірне вкладення');
    if (a.size > MAX_BYTES[kind]) throw new AttachmentError(`Файл завеликий (до ${Math.round(MAX_BYTES[kind] / 1024 / 1024)} МБ)`);
    return { kind, url: a.url, name: cleanName(a.name), size: Math.max(0, Math.round(a.size)) };
  });
}

/** Підпис для списку чатів і скарг, коли в повідомленні немає тексту */
export function attachmentsLabel(list: { kind: AttachmentKind; name: string }[]) {
  if (!list.length) return '';
  if (list.length > 1) return `Вкладення (${list.length})`;
  const a = list[0]!;
  return a.kind === 'image' ? 'Фото' : a.kind === 'video' ? 'Відео' : `Файл: ${a.name}`;
}
