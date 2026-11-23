import type { Model } from 'mongoose';

import { type ContractTerms, contractHash } from '../contract/contract.terms';
import type { DealDocument } from '../schemas/deal.schema';
import { legalComplete, partyLegal, unseal } from './legal.data';

/**
 * Після зміни даних для договору оновлює ще непідписані договори цієї людини: у знімку умов з'являється (чи зникає) її блок даних,
 * відбиток перераховується. Підписані договори не чіпаємо: вони зафіксовані.
 */
export async function syncUnsignedDeals(deals: Model<DealDocument>, userId: string, role: 'owner' | 'renter', legalEnc: string | undefined): Promise<{ id: string; ownerId: string; renterId: string; owner: boolean; renter: boolean; condition: DealDocument['condition'] }[]> {
  const data = legalComplete(legalEnc, role) ? unseal(legalEnc) : null;
  const mine = role === 'owner' ? { ownerId: userId } : { renterId: userId };
  const list = await deals
    .find({ ...mine, status: 'awaiting', 'contract.mode': { $ne: 'none' }, 'contract.signatures.owner': { $exists: false }, 'contract.signatures.renter': { $exists: false } })
    .exec();
  const out: { id: string; ownerId: string; renterId: string; owner: boolean; renter: boolean; condition: DealDocument['condition'] }[] = [];
  for (const d of list) {
    const terms = JSON.parse(JSON.stringify(d.contract!.terms)) as ContractTerms;
    if (data) terms[role].legal = partyLegal(data, role);
    else delete terms[role].legal;
    await deals
      .updateOne({ _id: d._id, 'contract.signatures.owner': { $exists: false }, 'contract.signatures.renter': { $exists: false } }, { $set: { 'contract.terms': terms, 'contract.hash': contractHash(terms) } }, { timestamps: false })
      .exec();
    out.push({ id: String(d._id), ownerId: String(d.ownerId), renterId: String(d.renterId), owner: !!terms.owner.legal, renter: !!terms.renter.legal, condition: d.condition });
  }
  return out;
}
