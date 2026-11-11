import { Types } from 'mongoose';

import type { LegalProfile } from '../common/legal';
import type { Purpose } from '../contract/contract.terms';
import { type ContractParty, buildTerms, contractHash, contractNumber } from '../contract/contract.terms';
import { fullName } from '../rentals/rentals.math';
import type { PaymentPlan } from './payment-plan';

type PersonDoc = { firstName: string; lastName: string; phone?: string; legal?: LegalProfile };
type CarDoc = { brand: string; model: string; year: number; vin: string; mileage: number; plate?: string; color?: string; fuel?: string };

/** Сторона договору. З юридичними даними ім'я записується як у документах (Прізвище Ім'я По батькові) */
export const party = (u: PersonDoc): ContractParty => {
  const phone = u.phone ?? '';
  if (!u.legal) return { name: fullName(u.firstName, u.lastName) || 'Користувач', phone };
  const { partyType, kved, rnokpp, idDoc, address, license } = u.legal;
  return {
    name: [u.lastName, u.firstName, u.legal.middleName].filter(Boolean).join(' '),
    phone,
    legal: { partyType, ...(kved ? { kved } : {}), rnokpp, idDoc, address, ...(license ? { license } : {}) },
  };
};

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
    // Юридичні дані сторін потрапляють у договір лише тоді, коли обидві натиснуть «Укласти договір» (formContract)
    owner: party({ firstName: input.owner.firstName, lastName: input.owner.lastName, phone: input.owner.phone }),
    renter: party({ firstName: input.renter.firstName, lastName: input.renter.lastName, phone: input.renter.phone }),
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
    // Договір ще чернетка: його формують і підписують, коли обидві сторони натиснуть «Укласти договір» (intent)
    contract: { terms, hash: contractHash(terms), signatures: {}, intent: {} },
    payments: terms.payments.map((p) => ({ n: p.n, renterPaid: 0, ownerReceived: 0 })),
  };
}
