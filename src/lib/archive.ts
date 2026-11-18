import type { ChatSummary } from './chat';
import type { RentalView } from './rentals';
import type { OfferView, WantedView } from './wanted';

/**
 * Що вже не потребує уваги й живе в «Архіві», а не в загальних списках: відхилені, скасовані, відкликані й завершені
 * запити та пропозиції, закриті заявки та розмови без активної домовленості.
 */
export const rentalArchived = (r: Pick<RentalView, 'status'>) => r.status === 'declined' || r.status === 'cancelled' || r.status === 'ended';

export const offerArchived = (o: Pick<OfferView, 'status'>) => o.status === 'declined' || o.status === 'withdrawn' || o.status === 'ended';

/** Заявка скасована, або виконана, а оренда з неї вже завершилась чи розірвана; виконана з чинною орендою — на «Головній» */
export const wantedArchived = (w: Pick<WantedView, 'status' | 'dealStage'>) =>
  w.status === 'cancelled' || (w.status === 'fulfilled' && !(w.dealStage === 'signing' || w.dealStage === 'upcoming' || w.dealStage === 'active'));

/** Розмова, де активної домовленості вже немає (чат лише для читання) або між сторонами є блокування */
export const chatArchived = (c: Pick<ChatSummary, 'canSend'>) => !c.canSend;
