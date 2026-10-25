import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderContractPdf } from '../src/contract/contract.pdf';
import { signContract } from '../src/contract/contract.signing';
import { buildSections, buildTerms, contractHash, contractNumber } from '../src/contract/contract.terms';
import { dealStageOf } from '../src/deals/deal-stage';

const terms = buildTerms({
  number: 'MR-20261025-ABC123',
  createdAt: new Date('2026-10-25T10:00:00Z'),
  city: 'Львів',
  owner: { name: 'Петро Власенко', phone: '+380501112233' },
  renter: { name: 'Олена Тестова', phone: '' },
  car: { title: 'Skoda Octavia 2020', brand: 'Skoda', model: 'Octavia', year: 2020, vin: 'TMBJG7NE0L0000000', mileage: 120000 },
  startDate: '2026-11-01',
  endDate: '2026-11-11',
  pricePerDay: 1200,
});

describe('contract terms', () => {
  it('номер містить дату й кінець id', () => assert.equal(contractNumber(new Date('2026-10-25T10:00:00Z'), '64b0000000000000000abc12'), 'MR-20261025-ABC12'.replace('ABC12', '0ABC12')));
  it('рахує діб і суму', () => {
    assert.equal(terms.days, 10);
    assert.equal(terms.total, 12000);
  });
  it('відбиток не залежить від порядку полів', () => {
    const reordered = { ...terms, owner: { phone: terms.owner.phone, name: terms.owner.name } };
    assert.equal(contractHash(reordered), contractHash(terms));
  });
  it('зміна умов змінює відбиток', () => assert.notEqual(contractHash({ ...terms, pricePerDay: 1300 }), contractHash(terms)));
  it('текст містить сторони, авто, період і ціну', () => {
    const text = buildSections(terms).flatMap((s) => [s.title, ...s.paragraphs]).join('\n');
    for (const part of ['Петро Власенко', 'Олена Тестова', 'Skoda Octavia 2020', 'TMBJG7NE0L0000000', '01.11.2026', '11.11.2026', '10 діб', '1 200 грн', '12 000 грн', '120 000 км']) assert.ok(text.includes(part), part);
  });
});

describe('signContract', () => {
  const h = contractHash(terms);
  const at = new Date('2026-10-25T11:00:00Z');
  it('ідентифікатор стабільний для тих самих даних', () => assert.equal(signContract({ contractHash: h, userId: 'u1', role: 'owner', at }).signatureId, signContract({ contractHash: h, userId: 'u1', role: 'owner', at }).signatureId));
  it('різний для різних сторін і текстів', () => {
    const a = signContract({ contractHash: h, userId: 'u1', role: 'owner', at }).signatureId;
    assert.notEqual(a, signContract({ contractHash: h, userId: 'u2', role: 'renter', at }).signatureId);
    assert.notEqual(a, signContract({ contractHash: 'other', userId: 'u1', role: 'owner', at }).signatureId);
  });
});

describe('dealStageOf з договором', () => {
  it('до підписання — signing, незалежно від дат', () => assert.equal(dealStageOf({ status: 'awaiting', startDate: '2026-11-01', endDate: '2026-11-11' }, '2026-11-05'), 'signing'));
  it('після підписання — за датами', () => {
    assert.equal(dealStageOf({ status: 'active', startDate: '2026-11-01', endDate: '2026-11-11' }, '2026-10-30'), 'upcoming');
    assert.equal(dealStageOf({ status: 'active', startDate: '2026-11-01', endDate: '2026-11-11' }, '2026-11-05'), 'active');
    assert.equal(dealStageOf({ status: 'active', startDate: '2026-11-01', endDate: '2026-11-11' }, '2026-11-12'), 'finished');
  });
  it('розірвана — завжди terminated', () => assert.equal(dealStageOf({ status: 'terminated', startDate: '2026-11-01', endDate: '2026-11-11' }, '2026-11-05'), 'terminated'));
});

describe('PDF договору', () => {
  it('генерується з кирилицею й підписами', async () => {
    const sig = signContract({ contractHash: contractHash(terms), userId: 'u1', role: 'owner' });
    const pdf = await renderContractPdf(terms, contractHash(terms), { owner: sig, renter: null });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 5000, `розмір ${pdf.length}`);
  });
});
