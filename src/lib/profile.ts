export type RentPurpose = 'taxi' | 'delivery' | 'personal' | 'business';
export const PURPOSE_LABELS: Record<RentPurpose, string> = { taxi: 'Таксі', delivery: 'Доставка', personal: 'Особисті поїздки', business: 'Робота й бізнес' };

/** Необов'язкові дані профілю: показуються іншим на сторінці профілю */
export type ProfileExtras = { city: string; photoUri: string; about: string; /** Рік, з якого водить; null — не вказано */ drivingSince: number | null; purposes: RentPurpose[] };

export type Profile = { firstName: string; lastName: string; middleName: string; phone: string } & Partial<ProfileExtras>;

/** Той самий шаблон, що й на сервері: цифри, +, пробіли, дужки, дефіси; 7–20 символів */
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

/** Телефон обов'язковий */
export const isValidPhone = (phone: string) => PHONE_PATTERN.test(phone.trim());
export const phoneError = (phone: string) => (!phone.trim() ? 'Вкажіть номер телефону' : isValidPhone(phone) ? '' : 'Невірний формат телефону');

export const fullName = (p: Pick<Profile, 'firstName' | 'lastName'>) => [p.firstName, p.lastName].filter(Boolean).join(' ');
