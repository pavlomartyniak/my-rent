import { Transform } from 'class-transformer';

/** Обрізає пробіли з країв рядка перед валідацією */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Телефон: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export const PHONE_TAKEN = 'Цей номер телефону вже використовується';

/**
 * Ключ для порівняння номерів: лише цифри, а українські номери зводяться до міжнародного вигляду, тож
 * «067 123 45 67», «+380671234567» і «380 (67) 123-45-67» — той самий номер.
 */
export function phoneKey(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `38${d}`;
  else if (d.length === 9) d = `380${d}`;
  return d;
}
