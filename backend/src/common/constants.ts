export const CAR_STATUSES = ['В оренді', 'Вільне', 'На сервісі'] as const;
export const EXPENSE_CATEGORIES = ['Ремонт', 'ТО', 'Страховка', 'Шини', 'Паливо', 'Інше'] as const;
export const INCOME_CATEGORY = 'Оренда';
export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export const REMINDER_KINDS = ['ТО', 'Страховка', 'Інше'] as const;

export const THEMES = ['system', 'light', 'dark'] as const;

export const ROLES = ['owner', 'renter'] as const;
export type Role = (typeof ROLES)[number];

export const RENTAL_STATUSES = ['pending', 'accepted', 'declined', 'cancelled'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const FREE_CAR_LIMIT = 1;
export const PRO_CAR_LIMIT = 20;
