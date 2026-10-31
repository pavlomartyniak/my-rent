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

import { signingState, signingWindow } from '../src/contract/contract.window';

describe('вікно підписання', () => {
  it('відкривається за добу до початку й триває 2 доби після', () => assert.deepEqual(signingWindow('2026-11-10'), { opensAt: '2026-11-09', closesAt: '2026-11-12' }));
  it('рано: більше ніж за добу до початку', () => assert.equal(signingState('2026-11-07', '2026-11-10'), 'early'));
  it('відкрито: напередодні, у день початку й ще 2 доби', () => {
    for (const day of ['2026-11-09', '2026-11-10', '2026-11-12']) assert.equal(signingState(day, '2026-11-10'), 'open', day);
  });
  it('пізно: після закриття', () => assert.equal(signingState('2026-11-13', '2026-11-10'), 'late'));
  it('межа місяця й року', () => assert.deepEqual(signingWindow('2027-01-01'), { opensAt: '2026-12-31', closesAt: '2027-01-03' }));
});

import { contractTotal, settledAmount, usedDays } from '../src/deals/deal-payments';

describe('автоматичні платежі за договором', () => {
  it('сума за договором — доби × ціна', () => assert.equal(contractTotal(1200, '2026-11-01', '2026-11-11'), 12000));
  it('до початку використано 0 діб, у день початку теж', () => {
    assert.equal(usedDays('2026-11-01', '2026-11-11', '2026-10-30'), 0);
    assert.equal(usedDays('2026-11-01', '2026-11-11', '2026-11-01'), 0);
  });
  it('з наступного дня — доби від початку, не менше однієї', () => {
    assert.equal(usedDays('2026-11-01', '2026-11-11', '2026-11-02'), 1);
    assert.equal(usedDays('2026-11-01', '2026-11-11', '2026-11-04'), 3);
  });
  it('після закінчення — не більше за договір', () => assert.equal(usedDays('2026-11-01', '2026-11-11', '2027-01-01'), 10));
  it('розрахунок при розірванні: за використані доби, до початку 0', () => {
    assert.equal(settledAmount(500, '2026-11-01', '2026-11-11', '2026-11-04'), 1500);
    assert.equal(settledAmount(500, '2026-11-01', '2026-11-11', '2026-10-30'), 0);
    assert.equal(settledAmount(500, '2026-11-01', '2026-11-11', '2026-12-01'), 5000);
  });
});

import { buildSchedule, planError } from '../src/deals/payment-plan';

describe('план оплати', () => {
  it('одразу: один платіж у день початку на всю суму', () => assert.deepEqual(buildSchedule('2026-11-01', '2026-11-11', 500, 'lump'), [{ n: 1, dueDate: '2026-11-01', days: 10, amount: 5000 }]));
  it('щомісяця: 90 діб = три рівні платежі кожні 30 діб', () => {
    const s = buildSchedule('2026-11-01', '2027-01-30', 100, 'monthly');
    assert.equal(s.length, 3);
    assert.deepEqual(s.map((p) => p.dueDate), ['2026-11-01', '2026-12-01', '2026-12-31']);
    assert.deepEqual(s.map((p) => p.amount), [3000, 3000, 3000]);
  });
  it('щомісяця: останній платіж на залишок, сума збігається з вартістю', () => {
    const s = buildSchedule('2026-11-01', '2027-01-15', 100, 'monthly'); // 75 діб
    assert.deepEqual(s.map((p) => p.days), [30, 30, 15]);
    assert.equal(s.reduce((n, p) => n + p.amount, 0), 7500);
  });
  it('щотижня: платіж за кожні 7 діб наперед, перший у день передачі, останній на залишок', () => {
    const s = buildSchedule('2026-11-01', '2026-11-23', 1000, 'weekly'); // 22 доби
    assert.deepEqual(s.map((p) => p.dueDate), ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22']);
    assert.deepEqual(s.map((p) => p.days), [7, 7, 7, 1]);
    assert.deepEqual(s.map((p) => p.amount), [7000, 7000, 7000, 1000]);
    assert.equal(s.reduce((n, p) => n + p.amount, 0), 22_000);
  });
  it('щодня: платіж за кожну добу, сума збігається з вартістю', () => {
    const s = buildSchedule('2026-11-01', '2026-11-06', 800, 'daily');
    assert.deepEqual(s.map((p) => p.dueDate), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    assert.ok(s.every((p) => p.days === 1 && p.amount === 800));
  });
  it('щотижня: рівно тиждень — це той самий один платіж, тож план не підходить', () => {
    assert.ok(planError('weekly', '2026-11-01', '2026-11-08')); // 7 діб
    assert.equal(planError('weekly', '2026-11-01', '2026-11-09'), null); // 8 діб: 7 + 1
  });
  it('щодня: від двох діб', () => {
    assert.ok(planError('daily', '2026-11-01', '2026-11-02')); // 1 доба
    assert.equal(planError('daily', '2026-11-01', '2026-11-03'), null);
  });
  it('одразу підходить для будь-якого строку', () => assert.equal(planError('lump', '2026-11-01', '2026-11-02'), null));
  it('щомісяця більше не можна обрати', () => assert.ok(planError('monthly', '2026-11-01', '2027-03-01')));
  it('договір містить графік платежів', () => {
    const t = buildTerms({
      number: 'MR-1', createdAt: new Date('2026-10-25T10:00:00Z'), city: 'Львів', owner: { name: 'А', phone: '' }, renter: { name: 'Б', phone: '' },
      car: { title: 'X', brand: 'X', model: 'X', year: 2020, vin: '', mileage: 1 }, startDate: '2026-11-01', endDate: '2027-01-30', pricePerDay: 100, paymentPlan: 'monthly',
    });
    const text = buildSections(t).flatMap((s) => s.paragraphs).join('\n');
    assert.ok(text.includes('Платіж 1: 01.11.2026') && text.includes('Платіж 3: 31.12.2026') && text.includes('щомісяця'));
  });
  const termsFor = (paymentPlan: 'weekly' | 'daily', endDate: string) =>
    buildSections(
      buildTerms({
        number: 'MR-1', createdAt: new Date('2026-10-25T10:00:00Z'), city: 'Львів', owner: { name: 'А', phone: '' }, renter: { name: 'Б', phone: '' },
        car: { title: 'X', brand: 'X', model: 'X', year: 2020, vin: '', mileage: 1 }, startDate: '2026-11-01', endDate, pricePerDay: 1000, paymentPlan,
      }),
    ).flatMap((s) => s.paragraphs).join('\n');
  it('договір щотижня описує правило й перелічує короткий графік', () => {
    const text = termsFor('weekly', '2026-11-23');
    assert.ok(text.includes('щотижня наперед') && text.includes('7 000 грн') && text.includes('Платіж 4: 22.11.2026'));
  });
  it('договір щодня описує правило без переліку платежів', () => {
    const text = termsFor('daily', '2026-11-11');
    assert.ok(text.includes('щодня наперед') && text.includes('10 платежів') && !text.includes('Платіж 2:'));
  });
  const withDeposit = (deposit?: number) =>
    buildTerms({
      number: 'MR-1', createdAt: new Date('2026-10-25T10:00:00Z'), city: 'Львів', owner: { name: 'А', phone: '' }, renter: { name: 'Б', phone: '' },
      car: { title: 'X', brand: 'X', model: 'X', year: 2020, vin: '', mileage: 1 }, startDate: '2026-11-01', endDate: '2026-11-11', pricePerDay: 1000, deposit,
    });
  it('застава потрапляє в умови й текст договору, але не в суму оренди', () => {
    const t = withDeposit(10_000);
    assert.equal(t.deposit, 10_000);
    assert.equal(t.total, 10_000); // 10 діб × 1000: застава окремо
    const text = buildSections(t).flatMap((x) => x.paragraphs).join('\n');
    assert.ok(text.includes('3.4. Гарантійний платіж (застава) становить 10 000 грн') && text.includes('3.5. За прострочення') && text.includes('не входить до її суми'));
  });
  it('без застави в умовах немає поля, а відбиток такий самий, як раніше', () => {
    for (const none of [undefined, 0]) {
      const t = withDeposit(none);
      assert.ok(!('deposit' in t));
      assert.ok(buildSections(t).flatMap((x) => x.paragraphs).join('\n').includes('3.4. За прострочення'));
    }
    assert.equal(contractHash(withDeposit(0)), contractHash(withDeposit(undefined)));
    assert.notEqual(contractHash(withDeposit(5000)), contractHash(withDeposit(0)));
  });
  it('довгий тижневий графік у тексті договору не перелічується', () => {
    const text = termsFor('weekly', '2027-06-01'); // ~30 тижнів
    assert.ok(text.includes('щотижня наперед') && !text.includes('Платіж 2:'));
  });
});
