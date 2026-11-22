import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Шифрування чутливих полів у базі (AES-256-GCM). Ключ береться зі змінної DATA_ENCRYPTION_KEY, а якщо її не задано, виводиться з JWT_SECRET.
 * Формат: v1.<iv>.<tag>.<дані> у base64url. Без ключа розшифрувати дані з бази неможливо.
 */
function key(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  if (!secret) throw new Error('Не задано DATA_ENCRYPTION_KEY чи JWT_SECRET для шифрування даних');
  return createHash('sha256').update(`kolo-data:${secret}`).digest();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptText(packed: string): string | null {
  try {
    const [v, iv, tag, data] = packed.split('.');
    if (v !== 'v1' || !iv || !tag || !data) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
