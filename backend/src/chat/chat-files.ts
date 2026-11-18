import { fixMulterName } from '../insurance/insurance.files';
import { cleanName } from './attachments';

/** Ліміт розміру файлу в чаті (для фото й відео діють свої ліміти в attachments.ts) */
export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;

/** Розширення виконуваних і небезпечних файлів, які в чат не приймаємо */
const BLOCKED_EXT = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif', 'sh', 'apk', 'jar', 'js', 'vbs', 'ps1', 'dll', 'app', 'dmg', 'pkg', 'lnk', 'reg', 'hta', 'cpl']);

export const extOf = (name: string) => /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? '';

/** Виконуваний файл за початком вмісту: Windows (MZ), Linux (ELF), macOS (Mach-O), скрипт із shebang */
export function looksExecutable(buf: Buffer) {
  if (buf.length < 4) return false;
  if (buf[0] === 0x4d && buf[1] === 0x5a) return true;
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;
  const magic = buf.readUInt32BE(0);
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(magic)) return true;
  return buf[0] === 0x23 && buf[1] === 0x21;
}

/** Тип вмісту для віддачі: за розширенням для звичайних документів, інакше нейтральний (завжди як вкладення, не для виконання) */
const MIME: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic',
};
export const mimeFor = (name: string) => MIME[extOf(name)] ?? 'application/octet-stream';

export class ChatFileError extends Error {}

/** Перевірка файлу для чату: розмір, непорожній, не виконуваний; повертає очищену назву й тип */
export function checkChatFile(file: { originalname: string; size: number; buffer: Buffer } | undefined) {
  if (!file?.buffer?.length) throw new ChatFileError('Додайте файл');
  if (file.size > MAX_CHAT_FILE_BYTES) throw new ChatFileError(`Файл завеликий (до ${MAX_CHAT_FILE_BYTES / 1024 / 1024} МБ)`);
  const name = cleanName(fixMulterName(file.originalname));
  if (BLOCKED_EXT.has(extOf(name)) || looksExecutable(file.buffer)) throw new ChatFileError('Такі файли (програми, скрипти) надсилати не можна');
  return { name, mime: mimeFor(name) };
}
