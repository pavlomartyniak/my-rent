import { Types } from 'mongoose';

import type { Purpose } from '../contract/contract.terms';
import { type ContractParty, buildTerms, contractHash, contractNumber } from '../contract/contract.terms';
import { fullName } from '../rentals/rentals.math';
import type { PaymentPlan } from './payment-plan';

type PersonDoc = { firstName: string; lastName: string; middleName?: string; phone?: string };
type CarDoc = { brand: string; model: string; year: number; vin: string; mileage: number; plate?: string; color?: string; fuel?: string };

/** Сторона договору: ПІБ повністю, як у документах (Прізвище Ім'я По батькові), і телефон */
export const party = (u: PersonDoc): ContractParty => ({
  name: [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ') || 'Користувач',
  phone: u.phone ?? '',
});

/** Дані авто для умов договору */
export const carTerms = (title: string, car: CarDoc) => ({
  title,
  brand: car.brand,
  model: car.model,
  year: car.year,
  vin: car.vin ?? '',
  mileage: car.mileage ?? 0,
  ...(car.plate ? { plate: car.plate } : {}),
  ...(car.color ? { color: car.color } : {}),
  ...(car.fuel ? { fuel: car.fuel } : {}),
});

/**
 * Дані нової оренди з договором. Вона створюється в статусі «підписання» (`awaiting`): оренда почнеться,
 * коли обидві сторони підпишуть договір, умови якого фіксуються тут і більше не змінюються.
 */
export function newDealData(input: {
  owner: PersonDoc;
  renter: PersonDoc;
  ownerId: Types.ObjectId;
  renterId: Types.ObjectId;
  carId: Types.ObjectId;
  car: CarDoc;
  title: string;
  photoUri?: string;
  city: string;
  pricePerDay: number;
  /** Застава, грн: фіксується в договорі; 0 чи без значення — без застави */
  deposit?: number;
  startDate: string;
  endDate: string;
  source: 'request' | 'offer';
  sourceId: Types.ObjectId;
  paymentPlan?: PaymentPlan;
  /** Мета використання авто (з запиту орендаря) */
  purpose?: Purpose;
}) {
  const _id = new Types.ObjectId();
  const createdAt = new Date();
  const terms = buildTerms({
    number: contractNumber(createdAt, String(_id)),
    createdAt,
    city: input.city,
    owner: party(input.owner),
    renter: party(input.renter),
    car: carTerms(input.title, input.car),
    startDate: input.startDate,
    endDate: input.endDate,
    pricePerDay: input.pricePerDay,
    deposit: input.deposit,
    paymentPlan: input.paymentPlan,
    purpose: input.purpose ?? 'personal',
  });
  return {
    _id,
    renterId: input.renterId,
    ownerId: input.ownerId,
    carId: input.carId,
    title: input.title,
    photoUri: input.photoUri,
    city: input.city,
    pricePerDay: input.pricePerDay,
    startDate: input.startDate,
    endDate: input.endDate,
    source: input.source,
    sourceId: input.sourceId,
    status: 'awaiting',
    contract: { terms, hash: contractHash(terms), signatures: {} },
    payments: terms.payments.map((p) => ({ n: p.n, renterPaid: 0, ownerReceived: 0 })),
  };
}
