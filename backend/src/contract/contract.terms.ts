import { createHash } from 'node:crypto';

import { type Installment, type PaymentPlan, buildSchedule, planLabel } from '../deals/payment-plan';
import { rentalDays, totalPrice } from '../rentals/rentals.math';

/** Умови договору оренди: знімок на момент прийняття домовленості, далі не змінюються */

export type ContractParty = { name: string; phone: string };

export type ContractTerms = {
  number: string;
  /** ISO-час формування */
  createdAt: string;
  city: string;
  owner: ContractParty;
  renter: ContractParty;
  car: { title: string; brand: string; model: string; year: number; vin: string; mileage: number };
  startDate: string;
  endDate: string;
  days: number;
  pricePerDay: number;
  total: number;
  /** План оплати й графік платежів: фіксуються разом з іншими умовами */
  paymentPlan: PaymentPlan;
  payments: Installment[];
  /** Застава (гарантійний платіж), грн. Є лише в договорах із заставою, тож відбиток решти договорів не змінюється */
  deposit?: number;
};

export type ContractSection = { title: string; paragraphs: string[] };

/** Номер вигляду MR-20261025-A1B2C3: дата й кінець ідентифікатора оренди */
export function contractNumber(createdAt: Date, dealId: string) {
  return `MR-${createdAt.toISOString().slice(0, 10).replace(/-/g, '')}-${dealId.slice(-6).toUpperCase()}`;
}

export function buildTerms(input: {
  number: string;
  createdAt: Date;
  city: string;
  owner: ContractParty;
  renter: ContractParty;
  car: ContractTerms['car'];
  startDate: string;
  endDate: string;
  pricePerDay: number;
  paymentPlan?: PaymentPlan;
  deposit?: number;
}): ContractTerms {
  return {
    number: input.number,
    createdAt: input.createdAt.toISOString(),
    city: input.city,
    owner: input.owner,
    renter: input.renter,
    car: input.car,
    startDate: input.startDate,
    endDate: input.endDate,
    days: rentalDays(input.startDate, input.endDate),
    pricePerDay: input.pricePerDay,
    total: totalPrice(input.pricePerDay, input.startDate, input.endDate),
    paymentPlan: input.paymentPlan ?? 'lump',
    payments: buildSchedule(input.startDate, input.endDate, input.pricePerDay, input.paymentPlan ?? 'lump'),
    ...(input.deposit && input.deposit > 0 ? { deposit: Math.round(input.deposit) } : {}),
  };
}

/** Відбиток умов: за ним видно, що текст договору після підписання не змінювали */
export function contractHash(terms: ContractTerms) {
  return createHash('sha256').update(JSON.stringify(sortKeys(terms))).digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

const money = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} грн`;
const date = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const plural = (n: number) => (n % 100 >= 11 && n % 100 <= 14 ? 'діб' : n % 10 === 1 ? 'доба' : n % 10 >= 2 && n % 10 <= 4 ? 'доби' : 'діб');

const paymentsWord = (n: number) => (n % 100 >= 11 && n % 100 <= 14 ? 'платежів' : n % 10 === 1 ? 'платіж' : n % 10 >= 2 && n % 10 <= 4 ? 'платежі' : 'платежів');

/** Скільки платежів перелічувати в тексті договору поштучно: довший графік описується правилом */
const MAX_LISTED = 12;

/** Пункти договору про порядок оплати: одразу вся сума чи графік платежів */
function paymentParagraphs(t: ContractTerms): string[] {
  const plan = t.paymentPlan ?? 'lump';
  const payments = t.payments ?? [];
  if (plan === 'weekly' && payments.length > 1) {
    return [
      `3.2. Оплата здійснюється щотижня наперед: за кожні 7 діб оренди (${money(t.pricePerDay * 7)}), останній платіж — за залишок строку. Усього ${payments.length} ${paymentsWord(payments.length)}. Перший платіж Орендар вносить під час передачі Авто, кожен наступний — у перший день відповідного тижня.`,
      // Довгий графік у тексті не перелічуємо: він є в застосунку, а правило вище однозначне
      ...(payments.length <= MAX_LISTED ? payments.map((p) => `Платіж ${p.n}: ${date(p.dueDate)} — ${money(p.amount)} (${p.days} ${plural(p.days)}).`) : []),
      '3.3. Сторони підтверджують отримання й сплату кожного платежу в застосунку Kolo для обліку.',
    ];
  }
  if (plan === 'daily' && payments.length > 1) {
    return [
      `3.2. Оплата здійснюється щодня наперед: за кожну добу оренди ${money(t.pricePerDay)}. Перший платіж Орендар вносить під час передачі Авто, кожен наступний — на початку відповідної доби. Усього ${payments.length} ${paymentsWord(payments.length)} за строк оренди.`,
      '3.3. Сторони підтверджують отримання й сплату в застосунку Kolo для обліку.',
    ];
  }
  if (plan === 'monthly' && payments.length > 1) {
    return [
      `3.2. Оплата здійснюється частинами, ${planLabel(plan)}: ${payments.length} ${payments.length < 5 ? 'платежі' : 'платежів'}. Перший платіж Орендар вносить під час передачі Авто, кожен наступний — у вказану дату.`,
      ...payments.map((p) => `Платіж ${p.n}: ${date(p.dueDate)} — ${money(p.amount)} (${p.days} ${plural(p.days)}).`),
      '3.3. Сторони підтверджують отримання й сплату кожного платежу в застосунку Kolo для обліку.',
    ];
  }
  return [
    `3.2. Оплата здійснюється ${planLabel(plan)}: Орендар сплачує всю суму ${money(t.total)} під час передачі Авто.`,
    '3.3. Сторони підтверджують отримання й сплату в застосунку Kolo для обліку.',
  ];
}

/** Пункт про заставу: це гарантійний платіж, а не орендна плата, тож у суму оренди він не входить */
const depositParagraph = (amount: number) =>
  `3.4. Гарантійний платіж (застава) становить ${money(amount)}. Орендар вносить його разом із першим платежем під час передачі Авто. Він не є орендною платою й не входить до її суми. Орендодавець повертає його протягом 3 діб після повернення Авто, за вирахуванням сум, які Орендар винен за цим договором (збитки за пошкодження Авто, штрафи, несплачена орендна плата), з письмовим поясненням підстав. Сторони підтверджують внесення застави в застосунку Kolo.`;

export const CONTRACT_DISCLAIMER =
  'Договір сформовано застосунком Kolo за типовим шаблоном на підставі умов, які погодили Сторони. Застосунок не є стороною договору й не надає юридичних консультацій.';

/** Текст договору за умовами: розділи для екрана та PDF */
export function buildSections(t: ContractTerms): ContractSection[] {
  const car = `${t.car.title}${t.car.vin ? `, VIN ${t.car.vin}` : ''}`;
  return [
    {
      title: 'Сторони',
      paragraphs: [
        `Орендодавець: ${t.owner.name}${t.owner.phone ? `, тел. ${t.owner.phone}` : ''}.`,
        `Орендар: ${t.renter.name}${t.renter.phone ? `, тел. ${t.renter.phone}` : ''}.`,
        'Разом названі «Сторони», уклали цей договір про таке.',
      ],
    },
    {
      title: '1. Предмет договору',
      paragraphs: [
        `1.1. Орендодавець передає Орендарю в тимчасове платне користування транспортний засіб: ${car}, ${t.car.year} р., пробіг на момент укладення договору ${t.car.mileage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} км (далі — Авто).`,
        '1.2. Авто передається в технічно справному стані. Стан Авто фіксується Сторонами під час передачі.',
      ],
    },
    {
      title: '2. Строк оренди',
      paragraphs: [
        `2.1. Строк оренди: з ${date(t.startDate)} по ${date(t.endDate)}, усього ${t.days} ${plural(t.days)}.`,
        '2.2. Авто передається в перший день строку оренди й повертається Орендарем в останній день строку, якщо Сторони не домовились про інше.',
      ],
    },
    {
      title: '3. Орендна плата та розрахунки',
      paragraphs: [
        `3.1. Орендна плата становить ${money(t.pricePerDay)} за добу. За весь строк оренди орієнтовно ${money(t.total)}.`,
        ...paymentParagraphs(t),
        ...(t.deposit ? [depositParagraph(t.deposit)] : []),
        `${t.deposit ? '3.5' : '3.4'}. За прострочення повернення Авто Орендар сплачує орендну плату за кожну добу прострочення в тому ж розмірі.`,
      ],
    },
    {
      title: '4. Права й обов’язки Орендодавця',
      paragraphs: [
        '4.1. Передати Орендарю справне Авто з документами, потрібними для його експлуатації.',
        '4.2. Не втручатись у законне користування Авто протягом строку оренди.',
        '4.3. Прийняти Авто після закінчення оренди та перевірити його стан разом з Орендарем.',
      ],
    },
    {
      title: '5. Права й обов’язки Орендаря',
      paragraphs: [
        '5.1. Користуватись Авто за призначенням і з дотриманням правил дорожнього руху. Якщо Авто використовується для комерційних перевезень (зокрема таксі), Орендар самостійно забезпечує наявність потрібних дозволів і несе відповідальність за їх відсутність.',
        '5.2. Своєчасно вносити орендну плату. Витрати на паливо, мийку та поточне обслуговування під час користування несе Орендар, якщо Сторони не домовились інакше.',
        '5.3. Штрафи за порушення, вчинені протягом строку оренди, сплачує Орендар.',
        '5.4. Не передавати Авто третім особам без письмової згоди Орендодавця.',
        '5.5. Повернути Авто в стані, у якому його отримано, з урахуванням нормального зносу.',
      ],
    },
    {
      title: '6. Відповідальність',
      paragraphs: [
        '6.1. За пошкодження чи втрату Авто з вини Орендаря він відшкодовує Орендодавцю реальні збитки, якщо не доведено, що шкода виникла не з його вини.',
        '6.2. За інші порушення Сторони відповідають відповідно до законодавства України.',
      ],
    },
    {
      title: '7. Розірвання договору',
      paragraphs: [
        '7.1. Договір можна достроково розірвати за взаємною згодою Сторін: одна Сторона пропонує розірвання в застосунку, а друга погоджується з ним.',
        '7.2. До підписання договору обома Сторонами кожна з них може скасувати домовленість.',
        '7.3. У разі розірвання Сторони розраховуються за фактичний строк користування Авто.',
      ],
    },
    {
      title: '8. Прикінцеві положення',
      paragraphs: [
        '8.1. Договір укладено в електронній формі та набирає чинності з моменту його підписання обома Сторонами. Кожна Сторона має доступ до тексту договору й може завантажити його в застосунку у форматі PDF.',
        '8.2. Сторони підписують договір під час особистої зустрічі, коли Орендодавець передає Авто та ключі, а Орендар — орендну плату. Підписання в застосунку означає, що Сторона ознайомилась із текстом договору та погоджується з його умовами.',
        '8.3. Спори вирішуються шляхом переговорів, а за недосягнення згоди — у суді за законодавством України.',
        CONTRACT_DISCLAIMER,
      ],
    },
  ];
}
