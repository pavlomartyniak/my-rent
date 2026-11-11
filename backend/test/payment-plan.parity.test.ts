import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addMonths as serverAddMonths, buildSchedule, isLongRental as serverIsLong, planError } from '../src/deals/payment-plan';
import { rentalDays, totalPrice } from '../src/rentals/rentals.math';
import { addMonths as appAddMonths, availablePlans, effectivePlan, isLongRental as appIsLong, type PaymentPlan } from '../../src/lib/payment-plan';

/**
 * Правила планів оплати написані двічі: на сервері (backend/src/deals/payment-plan.ts) і в застосунку
 * (src/lib/payment-plan.ts), бо спільного коду в них немає. Цей тест не дає копіям розійтися: якщо зміниш одну,
 * він упаде, доки не зміниш другу.
 */
const PLANS: PaymentPlan[] = ['lump', 'weekly', 'daily', 'monthly'];
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const FROM = Date.UTC(2026, 0, 1);
const TO = Date.UTC(2028, 2, 31); // охоплює лютий 2027 і високосний лютий 2028
const LENGTHS = [...Array.from({ length: 75 }, (_, i) => i), 89, 90, 91, 120, 180, 365];

/** Усі пари дат: кожен день початку × різні строки (0 діб — теж, як «одна доба») */
function* ranges() {
  for (let t = FROM; t <= TO; t += DAY) for (const len of LENGTHS) yield { start: iso(t), end: iso(t + len * DAY) };
}

describe('копії правил оплати (застосунок і сервер) збігаються', () => {
  it('addMonths однаковий для кожного дня і зсуву до 14 місяців', () => {
    for (let t = FROM; t <= TO; t += DAY) for (let n = 0; n <= 14; n++) assert.equal(appAddMonths(iso(t), n), serverAddMonths(iso(t), n), `${iso(t)} +${n}`);
  });

  it('isLongRental однаковий', () => {
    for (const { start, end } of ranges()) assert.equal(appIsLong(start, end), serverIsLong(start, end), `${start} → ${end}`);
  });

  it('застосунок пропонує рівно ті плани, які сервер приймає', () => {
    for (const { start, end } of ranges()) {
      const offered = availablePlans(start, end);
      for (const plan of PLANS) assert.equal(planError(plan, start, end) === null, offered.includes(plan), `${start} → ${end}, ${plan}`);
    }
  });

  it('effectivePlan завжди дає план, який сервер приймає', () => {
    for (const { start, end } of ranges()) for (const plan of PLANS) assert.equal(planError(effectivePlan(start, end, plan), start, end), null, `${start} → ${end}, ${plan}`);
  });
});

describe('графік платежів: інваріанти для всіх дозволених планів', () => {
  it('платежі покривають усі доби без дірок і наложень, а сума дорівнює вартості', () => {
    for (const { start, end } of ranges()) {
      for (const plan of PLANS) {
        if (planError(plan, start, end)) continue;
        const s = buildSchedule(start, end, 1000, plan);
        const label = `${start} → ${end}, ${plan}`;
        assert.equal(s.reduce((n, p) => n + p.days, 0), rentalDays(start, end), `${label}: доби`);
        assert.equal(s.reduce((n, p) => n + p.amount, 0), totalPrice(1000, start, end), `${label}: сума`);
        assert.equal(s[0]!.dueDate, start, `${label}: перший платіж у день передачі`);
        assert.ok(s.every((p) => p.days >= 1), `${label}: порожній період`);
        for (let i = 1; i < s.length; i++) assert.ok(s[i]!.dueDate > s[i - 1]!.dueDate, `${label}: дати зростають`);
        assert.ok(s.at(-1)!.dueDate < end || rentalDays(start, end) === 1, `${label}: останній платіж до завершення`);
      }
    }
  });
});
