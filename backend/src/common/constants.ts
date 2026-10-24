export const CAR_STATUSES = ['В оренді', 'Вільне', 'На сервісі'] as const;
export const EXPENSE_CATEGORIES = ['Ремонт', 'ТО', 'Страховка', 'Шини', 'Паливо', 'Інше'] as const;
export const INCOME_CATEGORY = 'Оренда';
export const TRANSACTION_TYPES = ['income', 'expense'] as const;
/** Облік орендаря: заробіток на орендованому авто (таксі тощо) і його витрати */
export const RENTER_INCOME_CATEGORY = 'Заробіток';
/** Платіж власнику за оренду: за ним рахується, скільки орендар платить за авто */
export const RENT_CATEGORY = 'Оренда авто';
export const RENTER_EXPENSE_CATEGORIES = [RENT_CATEGORY, 'Паливо', 'Мийка', 'Штраф', 'Ремонт', 'Інше'] as const;

export const REMINDER_KINDS = ['ТО', 'Страховка', 'Інше'] as const;

export const THEMES = ['system', 'light', 'dark'] as const;

export const ROLES = ['owner', 'renter'] as const;
export type Role = (typeof ROLES)[number];

/** Заявка орендаря «шукаю авто»: відкрита, виконана (прийняли пропозицію) або скасована */
export const WANTED_STATUSES = ['open', 'fulfilled', 'cancelled'] as const;
export type WantedStatus = (typeof WANTED_STATUSES)[number];

/** Пропозиція власника на заявку */
export const OFFER_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const RENTAL_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** Скільки фото можна додати до одного авто */
export const MAX_PHOTOS = 10;

export const FREE_CAR_LIMIT = 2;
export const PRO_CAR_LIMIT = 20;
