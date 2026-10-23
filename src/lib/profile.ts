export type Profile = { firstName: string; lastName: string; phone: string };

/** Той самий шаблон, що й на сервері: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Телефон необов'язковий: порожній вважається коректним */
export const isValidPhone = (phone: string) => !phone.trim() || PHONE_PATTERN.test(phone.trim());

export const fullName = (p: Pick<Profile, 'firstName' | 'lastName'>) => [p.firstName, p.lastName].filter(Boolean).join(' ');
