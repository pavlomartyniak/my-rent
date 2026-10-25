/** Відповіді ендпоінтів /market і /rentals */

export type MarketCar = {
  id: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  photoUri: string | null;
  /** Усі фото оголошення (https), обкладинка перша */
  photos: string[];
  city: string;
  pricePerDay: number;
  description: string;
  /** Ім'я власника з ініціалом прізвища */
  owner: string;
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
  /** План оплати: одразу вся сума чи щомісяця (від 60 діб) */
  paymentPlan: 'lump' | 'monthly';
  carId: string;
  startDate: string;
  endDate: string;
  days: number;
  totalPrice: number;
  message: string;
  decisionNote: string;
  createdAt: string;
  respondedAt: string | null;
  car: { title: string; city: string; pricePerDay: number; photoUri?: string };
  /** Для орендаря — власник, для власника — орендар; телефон віддається лише в чаті */
  counterpart: { name: string };
};

export const STATUS_LABEL: Record<RentalStatus, string> = {
  pending: 'Очікує відповіді',
  accepted: 'Прийнято',
  declined: 'Відхилено',
  cancelled: 'Скасовано',
  ended: 'Завершено',
};
