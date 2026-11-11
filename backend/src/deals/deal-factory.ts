import { Types } from 'mongoose';

import type { LegalProfile } from '../common/legal';
import type { Purpose } from '../contract/contract.terms';
import { type ContractParty, buildTerms, contractHash, contractNumber } from '../contract/contract.terms';
import { fullName } from '../rentals/rentals.math';
import type { PaymentPlan } from './payment-plan';

type PersonDoc = { firstName: string; lastName: string; phone?: string; legal?: LegalProfile };
type CarDoc = { brand: string; model: string; year: number; vin: string; mileage: number; plate?: string; regCertificate?: string; color?: string; fuel?: string };

/** Сторона договору. З юридичними даними ім'я записується як у документах (Прізвище Ім'я По батькові) */
const party = (u: PersonDoc): ContractParty => {
  const phone = u.phone ?? '';
  if (!u.legal) return { name: fullName(u.firstName, u.lastName) || 'Користувач', phone };
  const { partyType, kved, rnokpp, idDoc, address, license } = u.legal;
  return {
    name: [u.lastName, u.firstName, u.legal.middleName].filter(Boolean).join(' '),
    phone,
    legal: { partyType, ...(kved ? { kved } : {}), rnokpp, idDoc, address, ...(license ? { license } : {}) },
  };
};

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
    car: { title: input.title, brand: input.car.brand, model: input.car.model, year: input.car.year, vin: input.car.vin ?? '', mileage: input.car.mileage ?? 0, ...(input.car.plate ? { plate: input.car.plate } : {}), ...(input.car.regCertificate ? { regCertificate: input.car.regCertificate } : {}), ...(input.car.color ? { color: input.car.color } : {}), ...(input.car.fuel ? { fuel: input.car.fuel } : {}) },
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
