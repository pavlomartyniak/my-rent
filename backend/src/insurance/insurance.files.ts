/** Розмір поліса й допустимі види файлів: PDF і фото (JPEG, PNG, WebP, HEIC) */
export const MAX_POLICY_BYTES = 8 * 1024 * 1024;

export type PolicyMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/** Вид файлу за його початком (а не за тим, що заявив клієнт): так під видом PDF не підсунути щось інше */
export function sniffPolicy(buf: Buffer): PolicyMime | null {
  if (buf.length < 12) return null;
  // Специфікація PDF дозволяє заголовок %PDF- не лише з першого байта, а будь-де в перших 1024 байтах (так роблять деякі генератори й експорти)
  if (buf.subarray(0, 1024).toString('latin1').includes('%PDF-')) return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|hevc|mif1|msf1)/.test(buf.subarray(8, 12).toString('latin1'))) return 'image/heic';
  return null;
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
