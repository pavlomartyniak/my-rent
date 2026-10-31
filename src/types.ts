/** Заброньоване — домовленість прийнята, чекаємо підписання договору чи початку оренди; задається автоматично */
export const CAR_STATUSES = ['В оренді', 'Вільне', 'На сервісі', 'Заброньоване'] as const;
/** Статуси, які власник може вибрати вручну */
export const MANUAL_CAR_STATUSES = ['В оренді', 'Вільне', 'На сервісі'] as const;
/** Тип палива авто */
export const FUEL_TYPES = ['Бензин', 'Дизель', 'Газ', 'Гібрид', 'Електро'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
export type CarStatus = (typeof CAR_STATUSES)[number];

export type Car = {
  id: string;
  brand: string;
  model: string;
  year: number;
  vin: string;
  mileage: number;
  /** Тип палива; порожній — не вказано */
  fuel?: FuelType | '';
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
  listing?: { published: boolean; city: string; pricePerDay: number; deposit?: number; description: string };
  /** Чим відкрито публікацію: free — одним із безкоштовних місць (їх FREE_LISTINGS на власника), paid — разовою оплатою; без значення — ще не відкрита */
  listingUnlock?: 'free' | 'paid';
};

export type Role = 'owner' | 'renter';

export type TransactionType = 'income' | 'expense';

export const EXPENSE_CATEGORIES = ['Ремонт', 'ТО', 'Страховка', 'Шини', 'Паливо', 'Інше'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_CATEGORY = 'Оренда';

/** Облік орендаря: заробіток на орендованому авто й витрати; «Оренда авто» — платежі власнику */
export const RENTER_INCOME_CATEGORY = 'Заробіток';
export const RENT_CATEGORY = 'Оренда авто';
export const RENTER_EXPENSE_CATEGORIES = [RENT_CATEGORY, 'Паливо', 'Мийка', 'Штраф', 'Ремонт', 'Інше'] as const;

export type Transaction = {
  id: string;
  carId: string;
  /** Запис орендаря належить його оренді (авто власника в carId) */
  dealId?: string;
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

/** Публікація авто: перші авто безкоштовні, кожне наступне — разово за конкретне авто. Облік безкоштовний без ліміту */
export const FREE_LISTINGS = 2;
export const LISTING_PRICE = '5 $';
