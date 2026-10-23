import { Transform } from 'class-transformer';

/** Обрізає пробіли з країв рядка перед валідацією */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Телефон: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;
