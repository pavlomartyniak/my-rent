export type Profile = { firstName: string; lastName: string; middleName: string; phone: string };

/** Той самий шаблон, що й на сервері: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Телефон обов'язковий */
export const isValidPhone = (phone: string) => PHONE_PATTERN.test(phone.trim());
export const phoneError = (phone: string) => (!phone.trim() ? 'Вкажіть номер телефону' : isValidPhone(phone) ? '' : 'Невірний формат телефону');

export const fullName = (p: Pick<Profile, 'firstName' | 'lastName'>) => [p.firstName, p.lastName].filter(Boolean).join(' ');
