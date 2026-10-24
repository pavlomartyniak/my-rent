export const CAR_STATUSES = ['В оренді', 'Вільне', 'На сервісі'] as const;
export type CarStatus = (typeof CAR_STATUSES)[number];

export type Car = {
  id: string;
  brand: string;
  model: string;
  year: number;
  vin: string;
  mileage: number;
  /** ISO date, YYYY-MM-DD */
  rentStart: string;
  /** Вартість авто, база для ROI */
  price: number;
  status: CarStatus;
  /** Поточний водій / орендар */
  driver?: string;
  /** Фото авто: https-посилання (Cloudinary) або локальний URI, якщо завантаження не налаштоване */
  photoUri?: string;
  /** Усі фото авто (до 10); перше — обкладинка, дублюється в photoUri */
  photos?: string[];
  /** Оголошення про оренду; воно видиме орендарям, поки published=true і авто вільне */
  listing?: { published: boolean; city: string; pricePerDay: number; description: string };
};

export type Role = 'owner' | 'renter';

export type TransactionType = 'income' | 'expense';

export const EXPENSE_CATEGORIES = ['Ремонт', 'ТО', 'Страховка', 'Шини', 'Паливо', 'Інше'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_CATEGORY = 'Оренда';

export type Transaction = {
  id: string;
  carId: string;
  type: TransactionType;
  amount: number;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Для доходу — 'Оренда', для витрат — одна з EXPENSE_CATEGORIES */
  category: string;
  driver?: string;
  note?: string;
};

export const REMINDER_KINDS = ['ТО', 'Страховка', 'Інше'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type Reminder = {
  id: string;
  carId: string;
  kind: ReminderKind;
  /** ISO date, YYYY-MM-DD */
  date: string;
  done: boolean;
  /** Ідентифікатори запланованих локальних сповіщень */
  notificationIds?: string[];
};

export const FREE_CAR_LIMIT = 2;
export const PRO_CAR_LIMIT = 20;
export const PRO_PRICE = '$5';
