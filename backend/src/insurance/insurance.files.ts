/** Розмір поліса й допустимі види файлів: PDF і фото (JPEG, PNG, WebP, HEIC) */
export const MAX_POLICY_BYTES = 8 * 1024 * 1024;

export type PolicyMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/** Вид файлу за його початком (а не за тим, що заявив клієнт): так під видом PDF не підсунути щось інше */
export function sniffPolicy(buf: Buffer): PolicyMime | null {
  if (buf.length < 12) return null;
  // Підписаний контейнер (КЕП, .p7s) не є PDF, навіть коли містить його всередині: його обробляє extractSignedPdf
  if (buf[0] === 0x30) return null;
  // Специфікація PDF дозволяє заголовок %PDF- не лише з першого байта, а будь-де в перших 1024 байтах (так роблять деякі генератори й експорти)
  if (buf.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)/.test(buf.subarray(8, 12).toString('latin1'))) return 'image/heic';
  return null;
}

/**
 * Деякі страхові й сервіси (з електронним підписом, КЕП) віддають поліс як підписаний контейнер PKCS#7/CMS з розширенням .pdf:
 * PDF лежить усередині, але сам файл не відкривається як PDF. Якщо всередині цілий неушкоджений PDF, дістаємо його.
 * Перевіряємо, що це справжній суцільний PDF: покажчик `startxref` веде на таблицю xref чи об'єкт. Інакше (вміст розбитий
 * на шматки чи зашифрований) повертаємо null.
 */
export function extractSignedPdf(buf: Buffer): Buffer | null {
  if (buf[0] !== 0x30) return null;
  const text = buf.toString('latin1');
  const start = text.indexOf('%PDF-');
  const eof = text.lastIndexOf('%%EOF');
  if (start < 0 || eof < start) return null;
  const pdf = buf.subarray(start, eof + 5);
  const body = pdf.toString('latin1');
  const sx = body.lastIndexOf('startxref');
  const offset = sx < 0 ? NaN : Number(/^\s*(\d+)/.exec(body.slice(sx + 9))?.[1]);
  if (!Number.isFinite(offset) || offset <= 0 || offset >= pdf.length) return null;
  return /^(xref|\d+\s+\d+\s+obj)/.test(body.slice(offset, offset + 40)) ? pdf : null;
}

/** Файл полісу, готовий до збереження: вид і вміст (з підписаного контейнера діставляється PDF); null — не підтримується */
export function normalizePolicy(buf: Buffer): { mime: PolicyMime; data: Buffer } | null {
  const mime = sniffPolicy(buf);
  if (mime) return { mime, data: buf };
  const pdf = extractSignedPdf(buf);
  return pdf ? { mime: 'application/pdf', data: pdf } : null;
}

/**
 * Multer читає назву файлу як latin1, тож кирилиця приходить «кракозябрами». Якщо всі символи вкладаються в один байт,
 * перечитуємо їх як UTF-8; назву, що вже в Unicode, не чіпаємо.
 */
export function fixMulterName(name: string) {
  if ([...name].some((ch) => ch.charCodeAt(0) > 0xff)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** Назва файлу без шляхів і керівних символів, до 120 символів */
export function cleanFileName(name: string) {
  const flat = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\\/]+/g, '_').replace(/\s+/g, ' ').trim();
  return (flat || 'Страховий поліс').slice(0, 120);
}

/** Чи поліс уже не діє на дату `today` (обидві YYYY-MM-DD) */
export const policyExpired = (validUntil: string | undefined | null, today: string) => !!validUntil && validUntil < today;

/** Після `.lean()` двійкове поле приходить як BSON Binary, а не Buffer: `Buffer.from` на ньому дає порожній буфер, тому беремо його вміст явно */
export function binaryToBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  const raw = (data as { buffer?: Uint8Array } | null)?.buffer;
  if (raw) return Buffer.from(raw);
  return Buffer.from((data ?? []) as Uint8Array);
}

