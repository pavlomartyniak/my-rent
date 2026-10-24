import { createHash } from 'node:crypto';

/**
 * Підпис завантаження Cloudinary: усі параметри (крім file, cloud_name, resource_type, api_key),
 * відсортовані за назвою, у вигляді `name=value` через `&`, плюс API-секрет без роздільника; SHA-1 у hex.
 * https://cloudinary.com/documentation/authentication_signatures
 */
export function signUpload(params: Record<string, string | number>, apiSecret: string): string {
  const excluded = new Set(['file', 'cloud_name', 'resource_type', 'api_key']);
  const toSign = Object.entries(params)
    .filter(([key]) => !excluded.has(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}
