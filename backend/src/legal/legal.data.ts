import { decryptText, encryptText } from '../common/crypto';

/** Дані для договору: документ особи, адреса, РНОКПП. Зберігаються зашифрованими, показуються лише стороні договору */
export const DOC_TYPES = ['passport', 'id'] as const;
export const OWNERSHIP_BASES = ['owner', 'proxy'] as const;
export const LEGAL_CONSENT_VERSION = 1;

export type LegalData = {
  birthDate: string;
  taxId: string;
  docType: (typeof DOC_TYPES)[number];
  /** Паспорт-книжка: серія (2 літери); ID-картка: порожньо */
  docSeries: string;
  docNumber: string;
  /** Орган, що видав (паспорт: назва; ID-картка: 4 цифри) */
  docIssuer: string;
  docIssuedAt: string;
  /** ID-картка: дійсна до */
  docValidUntil: string;
  /** Адреса одним рядком для договору: складається з полів нижче (область, місто, вулиця, будинок, квартира) */
  address: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment: string;
  /** Орендар: посвідчення водія */
  licenseNumber: string;
  licenseIssuedAt: string;
  licenseValidUntil: string;
  /** Власник: на якій підставі розпоряджається авто */
  ownership: (typeof OWNERSHIP_BASES)[number];
  proxyNumber: string;
  proxyDate: string;
  proxyIssuer: string;
};

export const EMPTY_LEGAL: LegalData = {
  birthDate: '', taxId: '', docType: 'passport', docSeries: '', docNumber: '', docIssuer: '', docIssuedAt: '', docValidUntil: '', address: '', region: '', city: '', street: '', building: '', apartment: '',
  licenseNumber: '', licenseIssuedAt: '', licenseValidUntil: '', ownership: 'owner', proxyNumber: '', proxyDate: '', proxyIssuer: '',
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const digits = (s: string, n: number) => new RegExp(`^\\d{${n}}$`).test(s);
const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

const part = (v: unknown, max: number) => clean(v, max);

/** Тип вулиці вже вказано користувачем («вул. Зелена», «проспект Свободи»): другий раз не додаємо */
const STREET_TYPE = /^(вул\.?|вулиця|просп\.?|проспект|пров\.?|провулок|бульв\.?|бульвар|пл\.?|площа|шосе|набережна|наб\.?|узвіз|алея|тупик)(\s|$)/iu;

/** Адреса одним рядком для договору з окремих полів: «Львів, Львівська область, вул. Зелена, буд. 5, кв. 12» */
export function composeAddress(p: { region: string; city: string; street: string; building: string; apartment: string }) {
  if (!p.region && !p.city && !p.street && !p.building) return '';
  const street = p.street && (STREET_TYPE.test(p.street) ? p.street : `вул. ${p.street}`);
  return [p.city, p.region, street, p.building && `буд. ${p.building}`, p.apartment && `кв. ${p.apartment}`].filter(Boolean).join(', ');
}

/** Поля адреси й складений з них рядок. Дані, збережені до появи окремих полів, мають лише старий рядок: поля порожні, і їх треба заповнити */
function addressParts(input: Partial<Record<keyof LegalData, unknown>>) {
  const parts = { region: part(input.region, 80), city: part(input.city, 80), street: part(input.street, 100), building: part(input.building, 12).toUpperCase(), apartment: part(input.apartment, 10).toUpperCase() };
  const composed = composeAddress(parts);
  return { ...parts, address: composed || clean(input.address, 200) };
}

/** Приводить вхідні дані до вигляду, у якому їх зберігаємо: обрізані пробіли, велика серія, без зайвих полів іншої ролі */
export function normalizeLegal(input: Partial<Record<keyof LegalData, unknown>>): LegalData {
  const type = input.docType === 'id' ? 'id' : 'passport';
  return {
    birthDate: clean(input.birthDate, 10),
    taxId: clean(input.taxId, 10).replace(/\D/g, ''),
    docType: type,
    docSeries: type === 'passport' ? toCyrillic(clean(input.docSeries, 2)).replace(/\s/g, '') : '',
    docNumber: clean(input.docNumber, 9).replace(/\D/g, ''),
    docIssuer: clean(input.docIssuer, 120),
    docIssuedAt: clean(input.docIssuedAt, 10),
    docValidUntil: type === 'id' ? clean(input.docValidUntil, 10) : '',
    ...addressParts(input),
    licenseNumber: formatLicense(clean(input.licenseNumber, 20)),
    licenseIssuedAt: clean(input.licenseIssuedAt, 10),
    licenseValidUntil: clean(input.licenseValidUntil, 10),
    ownership: input.ownership === 'proxy' ? 'proxy' : 'owner',
    proxyNumber: clean(input.proxyNumber, 40),
    proxyDate: clean(input.proxyDate, 10),
    proxyIssuer: clean(input.proxyIssuer, 120),
  };
}

const DAY_MS = 86_400_000;
const ymd = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const addYears = (iso: string, years: number) => `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Латинські літери, схожі на кириличні (A, B, C…), замінюються на кириличні: серії документів в Україні кириличні */
const LOOKALIKE: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' };
export const toCyrillic = (s: string) => s.toUpperCase().replace(/[A-Z]/g, (c) => LOOKALIKE[c] ?? c);

/** Схоже на вигадане: однакові цифри чи літери підряд, послідовність 123456 */
export function looksFake(s: string) {
  const plain = s.replace(/\s/g, '');
  if (!plain) return false;
  if (/(.)\1{3,}/u.test(plain)) return true;
  if (/^\d+$/.test(plain) && plain.length >= 5) {
    const step = (a: string) => [...a].every((ch, i, arr) => i === 0 || Number(ch) - Number(arr[i - 1]) === 1) || [...a].every((ch, i, arr) => i === 0 || Number(arr[i - 1]) - Number(ch) === 1);
    if (step(plain)) return true;
  }
  return false;
}

/** Текст (адреса, орган, що видав) без «випадкових літер»: немає трьох однакових символів підряд */
const gibberish = (s: string) => /(.)\1{2,}/u.test(s.replace(/\s/g, ''));

/** РНОКПП: 10 цифр, контрольна цифра за вагами, а перші 5 цифр кодують дату народження (кількість днів від 31.12.1899, допуск ±1 день) */
export function taxIdProblem(taxId: string, birthDate: string): string | null {
  if (!/^\d{10}$/.test(taxId)) return 'РНОКПП — 10 цифр';
  const w = [-1, 5, 7, 9, 4, 6, 10, 5, 7];
  const sum = w.reduce((acc, k, i) => acc + k * Number(taxId[i]), 0);
  if (((sum % 11) + 11) % 11 % 10 !== Number(taxId[9])) return 'Такого РНОКПП не існує: перевірте цифри';
  if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    const days = Math.round((ymd(birthDate) - Date.UTC(1899, 11, 31)) / DAY_MS);
    if (Math.abs(days - Number(taxId.slice(0, 5))) > 1) return 'РНОКПП не збігається з датою народження';
  }
  return null;
}

const SERIES = /^[А-ЩЬЮЯЄІЇҐ]{2}$/;
const LICENSE = /^[А-ЩЬЮЯЄІЇҐ]{2,3}\d{6}$/;
const hasLetter = (s: string) => /\p{L}/u.test(s);

/** Номер посвідчення водія в записі «ААА 123456»: літери кирилицею, пробіл між серією й номером */
export function formatLicense(raw: string) {
  const plain = toCyrillic(raw).replace(/[^А-ЩЬЮЯЄІЇҐ0-9]/g, '');
  const m = /^([А-ЩЬЮЯЄІЇҐ]{2,3})(\d{1,6})$/.exec(plain);
  return m ? `${m[1]} ${m[2]}` : plain;
}

/** Що не так з даними (ключ поля → пояснення); порожній об'єкт — усе заповнено правдоподібно для цієї ролі */
export function legalProblems(d: LegalData, role: string): Record<string, string> {
  const e: Record<string, string> = {};
  const today = todayIso();
  const birth = isDate(d.birthDate) && d.birthDate <= today ? d.birthDate : null;
  if (!birth) e.birthDate = 'Вкажіть дату народження';
  else if (birth < addYears(today, -100)) e.birthDate = 'Перевірте дату народження';
  else if (birth > addYears(today, -18)) e.birthDate = 'Договір укладають з 18 років';
  const tax = taxIdProblem(d.taxId, d.birthDate);
  if (tax) e.taxId = tax;

  if (d.docType === 'passport') {
    if (!SERIES.test(d.docSeries)) e.docSeries = 'Серія — 2 літери кирилицею, наприклад АА';
    if (!digits(d.docNumber, 6)) e.docNumber = 'Номер — 6 цифр';
    else if (looksFake(d.docNumber)) e.docNumber = 'Схоже на вигаданий номер: перевірте за документом';
    if (d.docIssuer.length < 3 || !hasLetter(d.docIssuer)) e.docIssuer = 'Вкажіть, ким виданий, словами';
    else if (gibberish(d.docIssuer)) e.docIssuer = 'Схоже на випадкові літери: перевірте за документом';
  } else {
    if (!digits(d.docNumber, 9)) e.docNumber = 'Номер ID-картки — 9 цифр';
    else if (looksFake(d.docNumber)) e.docNumber = 'Схоже на вигаданий номер: перевірте за документом';
    if (!digits(d.docIssuer, 4) || looksFake(d.docIssuer) || d.docIssuer === '0000') e.docIssuer = 'Орган, що видав — 4 цифри з документа';
    if (!isDate(d.docValidUntil)) e.docValidUntil = 'Вкажіть, до якої дати дійсна';
    else if (d.docValidUntil <= today) e.docValidUntil = 'Документ уже недійсний';
    else if (isDate(d.docIssuedAt) && d.docValidUntil <= d.docIssuedAt) e.docValidUntil = 'Дата «дійсна до» має бути після дати видачі';
    else if (isDate(d.docIssuedAt) && d.docValidUntil > addYears(d.docIssuedAt, 10)) e.docValidUntil = 'ID-картка діє не більше 10 років: перевірте дату';
  }
  if (!isDate(d.docIssuedAt) || d.docIssuedAt > today) e.docIssuedAt = 'Вкажіть дату видачі';
  else if (birth && d.docIssuedAt < addYears(birth, 14)) e.docIssuedAt = 'Документ не міг бути виданий раніше 14 років';

  if (d.region.length < 3) e.region = 'Оберіть область';
  if (d.city.length < 2 || !hasLetter(d.city)) e.city = 'Оберіть місто чи село';
  else if (gibberish(d.city)) e.city = 'Схоже на випадкові літери: перевірте назву';
  if (d.street.length < 2 || !hasLetter(d.street)) e.street = 'Вкажіть вулицю';
  else if (gibberish(d.street)) e.street = 'Схоже на випадкові літери: перевірте назву вулиці';
  if (!/^\d+[\p{L}\d/\-]{0,9}$/u.test(d.building)) e.building = 'Номер будинку, наприклад 5, 12А чи 7/2';
  if (d.apartment && !/^[\p{L}\d/\-]{1,8}$/u.test(d.apartment)) e.apartment = 'Номер квартири, наприклад 12 чи 3Б';

  if (role === 'renter') {
    if (!LICENSE.test(d.licenseNumber.replace(/\s/g, ''))) e.licenseNumber = 'Серія й номер: літери та 6 цифр, наприклад ААА 123456';
    else if (looksFake(d.licenseNumber)) e.licenseNumber = 'Схоже на вигаданий номер: перевірте за посвідченням';
    if (!isDate(d.licenseIssuedAt) || d.licenseIssuedAt > today) e.licenseIssuedAt = 'Вкажіть дату видачі';
    else if (birth && d.licenseIssuedAt < addYears(birth, 18)) e.licenseIssuedAt = 'Посвідчення водія видають з 18 років';
    if (!isDate(d.licenseValidUntil)) e.licenseValidUntil = 'Вкажіть, до якої дати дійсне';
    else if (d.licenseValidUntil <= today) e.licenseValidUntil = 'Посвідчення вже недійсне';
    else if (isDate(d.licenseIssuedAt) && d.licenseValidUntil <= d.licenseIssuedAt) e.licenseValidUntil = 'Дата «дійсне до» має бути після дати видачі';
  } else if (d.ownership === 'proxy') {
    if (d.proxyNumber.length < 1 || gibberish(d.proxyNumber)) e.proxyNumber = 'Вкажіть номер довіреності';
    if (!isDate(d.proxyDate) || d.proxyDate > today) e.proxyDate = 'Вкажіть дату довіреності';
    if (d.proxyIssuer.length < 3 || !hasLetter(d.proxyIssuer) || gibberish(d.proxyIssuer)) e.proxyIssuer = 'Вкажіть, хто посвідчив (нотаріус чи орган)';
  }
  return e;
}

export const seal = (d: LegalData) => encryptText(JSON.stringify(d));

export function unseal(packed: string | undefined | null): LegalData | null {
  if (!packed) return null;
  const text = decryptText(packed);
  if (!text) return null;
  try {
    return normalizeLegal(JSON.parse(text) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Чи заповнені дані повністю для цієї ролі */
export const legalComplete = (packed: string | undefined | null, role: string) => {
  const d = unseal(packed);
  return !!d && Object.keys(legalProblems(d, role)).length === 0;
};

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Рядки для тексту договору: те, що потрапляє в знімок умов */
export type PartyLegal = { birthDate: string; taxId: string; document: string; address: string; extra?: string; license?: { number: string; validUntil: string } };

export function partyLegal(d: LegalData, role: string): PartyLegal {
  const doc =
    d.docType === 'passport'
      ? `паспорт серія ${d.docSeries} № ${d.docNumber}, виданий ${d.docIssuer} ${dmy(d.docIssuedAt)}`
      : `ID-картка № ${d.docNumber}, орган, що видав, ${d.docIssuer}, дата видачі ${dmy(d.docIssuedAt)}, дійсна до ${dmy(d.docValidUntil)}`;
  const extra =
    role === 'renter'
      ? `посвідчення водія ${d.licenseNumber}, видане ${dmy(d.licenseIssuedAt)}, дійсне до ${dmy(d.licenseValidUntil)}`
      : d.ownership === 'proxy'
        ? `діє за довіреністю № ${d.proxyNumber} від ${dmy(d.proxyDate)}, посвідченою: ${d.proxyIssuer}`
        : 'власник Авто за свідоцтвом про реєстрацію';
  return { birthDate: dmy(d.birthDate), taxId: d.taxId, document: doc, address: d.address, extra, ...(role === 'renter' ? { license: { number: d.licenseNumber, validUntil: dmy(d.licenseValidUntil) } } : {}) };
}

/** Маска для показу: УСЯ інформація про особу не світиться на екрані без потреби */
export const maskTail = (s: string, keep = 2) => (s.length <= keep ? s : `${'•'.repeat(Math.max(s.length - keep, 3))}${s.slice(-keep)}`);
