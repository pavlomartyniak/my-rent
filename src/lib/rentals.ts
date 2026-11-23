import type { PaymentPlan } from '@/lib/payment-plan';

/** Відповіді ендпоінтів /market і /rentals */

export type MarketCar = {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  /** Тип палива; порожній — не вказано */
  fuel: string;
  /** Колір авто (необов'язково); державний номер публічно не показується */
  color?: string;
  photoUri: string | null;
  /** Усі фото оголошення (https), обкладинка перша */
  photos: string[];
  city: string;
  pricePerDay: number;
  /** Застава, ₴: вноситься разом із першою оплатою; 0 — без застави */
  deposit: number;
  description: string;
  /** Вимога регулярного фотозвіту про авто; null — не вимагається */
  checkin?: { every: 'weekly' | 'biweekly' | 'monthly'; weekday: number; body: boolean; interior: boolean; requirement: string } | null;
  /** Ім'я власника з ініціалом прізвища */
  owner: string;
  ownerId: string;
  /** Фото профілю власника, якщо додано */
  ownerPhotoUri?: string | null;
  /** Мій запит на це авто, що чекає відповіді (повторний надіслати не можна) */
  myRequest?: { id: string; status: string } | null;
};

export type MarketPage = { page: number; pages: number; total: number; items: MarketCar[] };

export type RentalStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'ended';

export type RentalView = {
  id: string;
  status: RentalStatus;
  /** Оренда, що виросла з прийнятого запиту, і її етап (upcoming/active/finished/terminated): показується замість «Прийнято» */
  dealId: string | null;
  dealStage: string | null;
  /** Чи є в оренди договір */
  hasContract: boolean;
  /** План оплати: одразу вся сума, щотижня чи щодня */
  paymentPlan: PaymentPlan;
  carId: string;
  startDate: string;
  endDate: string;
  days: number;
  totalPrice: number;
  message: string;
  decisionNote: string;
  createdAt: string;
  respondedAt: string | null;
  car: { title: string; city: string; pricePerDay: number; deposit?: number; photoUri?: string };
  /** Для орендаря — власник, для власника — орендар; телефон віддається лише в чаті */
  counterpart: { id: string; name: string; photoUri?: string | null };
};

export const STATUS_LABEL: Record<RentalStatus, string> = {
  pending: 'Очікує відповіді',
  accepted: 'Прийнято',
  declined: 'Відхилено',
  cancelled: 'Скасовано',
  ended: 'Завершено',
};
