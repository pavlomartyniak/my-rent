import { Types } from 'mongoose';

import { type ContractParty, buildTerms, contractHash, contractNumber } from '../contract/contract.terms';
import { fullName } from '../rentals/rentals.math';

type PersonDoc = { firstName: string; lastName: string; phone?: string };
type CarDoc = { brand: string; model: string; year: number; vin: string; mileage: number };

const party = (u: PersonDoc): ContractParty => ({ name: fullName(u.firstName, u.lastName) || 'Користувач', phone: u.phone ?? '' });

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
  startDate: string;
  endDate: string;
  source: 'request' | 'offer';
  sourceId: Types.ObjectId;
}) {
  const _id = new Types.ObjectId();
  const createdAt = new Date();
  const terms = buildTerms({
    number: contractNumber(createdAt, String(_id)),
    createdAt,
    city: input.city,
    owner: party(input.owner),
    renter: party(input.renter),
    car: { title: input.title, brand: input.car.brand, model: input.car.model, year: input.car.year, vin: input.car.vin ?? '', mileage: input.car.mileage ?? 0 },
    startDate: input.startDate,
    endDate: input.endDate,
    pricePerDay: input.pricePerDay,
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
  };
}
