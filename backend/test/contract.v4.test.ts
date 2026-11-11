import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSections, buildTerms, TEMPLATE_VERSION, uahWords, V4, type ContractParty } from '../src/contract/contract.terms';

const legal = (over: object = {}) => ({ partyType: 'individual' as const, rnokpp: '3000000008', idDoc: { type: 'id_card' as const, series: '', number: '123456789', issuedBy: '1234', issuedAt: '2022-05-01' }, address: 'м. Київ, вул. Хрещатик, 1, кв. 2', ...over });
const owner: ContractParty = { name: 'Власенко Петро Іванович', phone: '+380501112233', legal: legal() };
const renter: ContractParty = { name: 'Тестова Олена Петрівна', phone: '+380509998877', legal: legal({ license: { series: 'ААА', number: '123456', validUntil: '2030-01-01' } }) };
const base = {
  number: 'MR-1', createdAt: new Date('2026-11-12T10:00:00Z'), city: 'Львів', owner, renter,
  car: { title: 'Skoda Octavia 2020', brand: 'Skoda', model: 'Octavia', year: 2020, vin: 'TMBJG7NE0L0000000', mileage: 1, plate: 'AA1234BB', color: 'сірий', fuel: 'Бензин' },
  startDate: '2026-11-20', endDate: '2026-11-30', pricePerDay: 1200,
};
const text = (t: ReturnType<typeof buildTerms>) => buildSections(t).flatMap((s) => [s.title, ...s.paragraphs]).join('\n');

describe('шаблон договору версії 4 (посилена редакція)', () => {
  it('нові договори створюються за версією 4', () => assert.equal(buildTerms(base).templateVersion, 4));
  it('є всі 13 розділів і сторони', () => {
    const titles = buildSections(buildTerms(base)).map((s) => s.title);
    assert.deepEqual(titles, ['Сторони', '1. Предмет і гарантії', '2. Строк, передача Авто', '3. Мета використання та обмеження', '4. Плата за найм', '5. Гарантійний платіж', '6. Утримання, ремонт, страхування', '7. ДТП, пошкодження, викрадення', '8. Відповідальність', '9. Дострокове припинення', '10. Повернення Авто', '11. Повідомлення', '12. Укладення та підписання', '13. Прикінцеві положення']);
  });
  it('сторони й авто з повними даними', () => {
    const s = text(buildTerms(base));
    assert.match(s, /Наймодавець \(Орендодавець\): Власенко Петро Іванович, РНОКПП 3000000008, документ про особу: ID-картка № 123456789/);
    assert.match(s, /Наймач \(Орендар\): Тестова Олена Петрівна.*посвідчення водія серії ААА № 123456, дійсне до 01\.01\.2030/);
    assert.match(s, /Skoda Octavia, рік випуску 2020, колір сірий, VIN TMBJG7NE0L0000000, державний номер AA1234BB, вид палива бензин/);
  });
  it('у п. 1.1 немає даних свідоцтва про реєстрацію: потрібен лише державний номер', () => {
    const s = text(buildTerms(base));
    assert.match(s, /1\.1\..*державний номер AA1234BB/);
    assert.doesNotMatch(s.split('1.2.')[0]!, /свідоцтво про реєстрацію ТЗ [А-ЯA-Z]/);
    const noColor = text(buildTerms({ ...base, car: { ...base.car, color: undefined } }));
    assert.doesNotMatch(noColor, /колір/);
  });
  it('між фізособами — електронна форма без нотаріуса (п. 1.3), між ФОП — господарська діяльність', () => {
    assert.match(text(buildTerms(base)), /1\.3\. Сторони домовились укласти Договір у письмовій електронній формі в порядку розд\. 12 без нотаріального посвідчення/);
    const fop = (p: ContractParty): ContractParty => ({ ...p, legal: { ...p.legal!, partyType: 'fop', kved: '49.32' } });
    const s = text(buildTerms({ ...base, owner: fop(owner), renter: fop(renter), purpose: 'delivery' }));
    assert.match(s, /1\.3\. Сторони укладають Договір як фізичні особи-підприємці.*для доставка/s);
    assert.match(s, /зареєстрований як ФОП, КВЕД 49\.32/);
    assert.doesNotMatch(s, /1\.3\. Сторони домовились/);
  });
  it('змішаний статус (ФОП і фізособа) — загальний варіант п. 1.3', () => {
    const s = text(buildTerms({ ...base, owner: { ...owner, legal: { ...owner.legal!, partyType: 'fop', kved: '49.32' } } }));
    assert.match(s, /1\.3\. Сторони домовились/);
  });
  it('мета використання', () => {
    assert.match(text(buildTerms({ ...base, purpose: 'passengers' })), /3\.1\. Мета: перевезення пасажирів через онлайн-сервіси/);
    assert.match(text(buildTerms({ ...base, purpose: 'personal' })), /3\.1\. Мета: особисті потреби/);
  });
  it('ціна, сума словами, графік у п. 4', () => {
    const s = text(buildTerms({ ...base, paymentPlan: 'weekly' }));
    assert.match(s, /4\.1\. Плата: 1 200 грн за добу без ПДВ\. Загальна сума за строк: 12 000 грн \(дванадцять тисяч гривень\)/);
    assert.match(s, /4\.2\. Оплата здійснюється щотижня наперед/);
    assert.match(s, /4\.7\. Зміна ціни, графіка чи строку можлива лише за письмовою згодою обох Сторін у чаті Kolo/);
    assert.doesNotMatch(s, /3\.2\. Оплата|3\.3\. Сторони підтверджують/);
  });
  it('гарантійний платіж: розділ 5 із сумою; без нього — прямо сказано', () => {
    assert.match(text(buildTerms({ ...base, deposit: 5000 })), /5\.1\. На забезпечення виконання зобов’язань Наймач вносить гарантійний платіж 5 000 грн \(п’ять тисяч гривень\).*ч\. 2 ст\. 546 ЦК/);
    assert.match(text(buildTerms(base)), /5\.1\. Гарантійний платіж цим Договором не передбачено/);
    assert.doesNotMatch(text(buildTerms({ ...base, deposit: 5000 })), /застава/i);
  });
  it('п. 1.7: серія, номер і строк дії посвідчення, обов’язок діяти весь строк найму', () => {
    const s = text(buildTerms(base));
    assert.match(s, /1\.7\. Наймач гарантує, що має чинне посвідчення водія відповідної категорії \(серія ААА № 123456, дійсне до 01\.01\.2030\)/);
    assert.match(s, /Посвідчення має діяти протягом усього строку найму; якщо воно втрачає чинність.*припиняє керувати Авто/);
    const noLicense = text(buildTerms({ ...base, renter: { ...renter, legal: { ...renter.legal!, license: undefined } } }));
    assert.match(noLicense, /1\.7\. Наймач гарантує, що має чинне посвідчення водія відповідної категорії і не позбавлений/);
  });
  it('п. 6.6: обов’язок мати ОСЦПВ без даних полісу', () => {
    const s = text(buildTerms(base));
    assert.match(s, /6\.6\. Наймодавець забезпечує чинний договір обов’язкового страхування цивільно-правової відповідальності \(ОСЦПВ\)/);
    assert.doesNotMatch(s, /поліс №|страховик /);
  });
  it('штрафи й строки беруться з параметрів редакції', () => {
    const s = text(buildTerms(base));
    assert.match(s, new RegExp(`пеню ${V4.penaltyPct}% від простроченої суми`));
    assert.match(s, /передача Авто третій особі чи піднайм \(п\. 3\.3\) — 10 добових плат/);
    assert.match(s, /плату прострочено більше ніж на 2 дні/);
    assert.match(s, /Договір вважається розірваним через 12 годин після доставки повідомлення/);
    assert.match(s, /13\.3\. Сторони визнають цей Договір укладеним у письмовій формі/);
    assert.doesNotMatch(s, /нотаріальн[а-я]+ посвідчення[^.]*(вимаг|ухилен)/i);
    assert.match(s, /13\.5\. Місце виконання Договору — м\. Львів/);
  });
  it('у тексті немає актів, додаткових угод і журналу подій: застосунок їх не веде', () => {
    const s = text(buildTerms({ ...base, deposit: 5000 }));
    assert.doesNotMatch(s, /\bАкт|\bакт[іау]|додатков[а-я]+ угод|журнал/);
    assert.match(s, /2\.4\. Договір набирає чинності з моменту підписання обома Сторонами\. Якщо Договір не підписаний/);
  });
  it('спосіб підписання відповідає застосунку: код з e-mail, а не SMS', () => {
    const s = text(buildTerms(base));
    assert.match(s, /простим електронним підписом.*одноразовим кодом.*електронної пошти/s);
    assert.doesNotMatch(s, /кодом з SMS/);
  });
  it('версія в параметрах не змінюється мовчки: договір версії 3 читається за старим текстом', () => {
    const v3 = buildSections({ ...buildTerms(base), templateVersion: 3 });
    assert.ok(v3.some((s) => s.title === '8. Прикінцеві положення'));
    assert.equal(TEMPLATE_VERSION, 4);
  });
});

describe('сума словами', () => {
  const cases: [number, string][] = [
    [1, 'одна гривня'], [2, 'дві гривні'], [5, 'п’ять гривень'], [11, 'одинадцять гривень'], [21, 'двадцять одна гривня'],
    [100, 'сто гривень'], [1000, 'одна тисяча гривень'], [2000, 'дві тисячі гривень'], [5000, 'п’ять тисяч гривень'], [12000, 'дванадцять тисяч гривень'],
    [21000, 'двадцять одна тисяча гривень'], [123456, 'сто двадцять три тисячі чотириста п’ятдесят шість гривень'], [1_000_000, 'один мільйон гривень'],
    [2_500_000, 'два мільйони п’ятсот тисяч гривень'],
  ];
  for (const [n, words] of cases) it(`${n} → ${words}`, () => assert.equal(uahWords(n), words));
});
