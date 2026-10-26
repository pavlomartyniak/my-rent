/** Відповіді ендпоінтів /wanted і /offers */

export type WantedStatus = 'open' | 'fulfilled' | 'cancelled';
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'ended';

export type WantedView = {
  id: string;
  /** Порожні — «будь-яка марка / модель» */
  brand: string;
  model: string;
  city: string;
  startDate: string;
  endDate: string;
  days: number;
  maxPricePerDay: number | null;
  notes: string;
  status: WantedStatus;
  createdAt: string;
  /** Для виконаної заявки: етап оренди, що з неї виросла (upcoming/active/finished/terminated) */
  dealStage?: string | null;
  /** Оренда, що виросла з виконаної заявки */
  dealId?: string | null;
  /** Для орендаря: скільки пропозицій отримано */
  offers?: { pending: number; total: number };
  /** Для власника: орендар як «Ім'я П.» і чи є вже моя пропозиція */
  renter?: string;
  myOffer?: boolean;
  /** Для власника: мої вільні авто, що підходять під заявку */
  matches?: { id: string; title: string }[];
};

export type WantedBoard = { page: number; pages: number; total: number; items: WantedView[] };

export type OfferView = {
  id: string;
  status: OfferStatus;
  /** Оренда, що виросла з прийнятої пропозиції, і її етап: показується замість «Прийнято» */
  dealId: string | null;
  dealStage: string | null;
  hasContract: boolean;
  paymentPlan: 'lump' | 'monthly';
  wantedId: string;
  carId: string;
  pricePerDay: number;
  days: number;
  totalPrice: number;
  message: string;
  decisionNote: string;
  createdAt: string;
  car: { title: string; brand: string; model: string; year: number; mileage: number; fuel?: string; photoUri?: string; photos: string[] };
  /** Для орендаря — власник, для власника — орендар; телефон віддається лише в чаті */
  counterpart: { name: string };
  wanted: { city: string; brand: string; model: string; startDate: string; endDate: string; status: WantedStatus };
};

export type WantedOffers = { wanted: WantedView; offers: OfferView[] };

export const wantedTitle = (w: Pick<WantedView, 'brand' | 'model'>) => [w.brand, w.model].filter(Boolean).join(' ') || 'Будь-яке авто';
