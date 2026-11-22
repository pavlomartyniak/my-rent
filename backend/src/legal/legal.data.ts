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
  address: string;
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
  birthDate: '', taxId: '', docType: 'passport', docSeries: '', docNumber: '', docIssuer: '', docIssuedAt: '', docValidUntil: '', address: '',
  licenseNumber: '', licenseIssuedAt: '', licenseValidUntil: '', ownership: 'owner', proxyNumber: '', proxyDate: '', proxyIssuer: '',
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const digits = (s: string, n: number) => new RegExp(`^\\d{${n}}$`).test(s);
const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Приводить вхідні дані до вигляду, у якому їх зберігаємо: обрізані пробіли, велика серія, без зайвих полів іншої ролі */
export function normalizeLegal(input: Partial<Record<keyof LegalData, unknown>>): LegalData {
  const type = input.docType === 'id' ? 'id' : 'passport';
  return {
    birthDate: clean(input.birthDate, 10),
    taxId: clean(input.taxId, 10).replace(/\D/g, ''),
    docType: type,
    docSeries: type === 'passport' ? clean(input.docSeries, 2).toUpperCase().replace(/\s/g, '') : '',
    docNumber: clean(input.docNumber, 9).replace(/\D/g, ''),
    docIssuer: clean(input.docIssuer, 120),
    docIssuedAt: clean(input.docIssuedAt, 10),
    docValidUntil: type === 'id' ? clean(input.docValidUntil, 10) : '',
    address: clean(input.address, 200),
    licenseNumber: clean(input.licenseNumber, 20).toUpperCase(),
    licenseIssuedAt: clean(input.licenseIssuedAt, 10),
    licenseValidUntil: clean(input.licenseValidUntil, 10),
    ownership: input.ownership === 'proxy' ? 'proxy' : 'owner',
    proxyNumber: clean(input.proxyNumber, 40),
    proxyDate: clean(input.proxyDate, 10),
    proxyIssuer: clean(input.proxyIssuer, 120),
  };
}

/** Що не так з даними (ключ поля → пояснення); порожній об'єкт — усе заповнено для цієї ролі */
export function legalProblems(d: LegalData, role: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!isDate(d.birthDate) || d.birthDate > new Date().toISOString().slice(0, 10)) e.birthDate = 'Вкажіть дату народження';
  else if (new Date().getFullYear() - Number(d.birthDate.slice(0, 4)) < 18) e.birthDate = 'Договір укладають з 18 років';
  if (!digits(d.taxId, 10)) e.taxId = 'РНОКПП — 10 цифр';
  if (d.docType === 'passport') {
    if (!/^[А-ЯІЇЄҐA-Z]{2}$/.test(d.docSeries)) e.docSeries = 'Серія — 2 літери';
    if (!digits(d.docNumber, 6)) e.docNumber = 'Номер — 6 цифр';
    if (d.docIssuer.length < 3) e.docIssuer = 'Вкажіть, ким виданий';
  } else {
    if (!digits(d.docNumber, 9)) e.docNumber = 'Номер ID-картки — 9 цифр';
    if (!digits(d.docIssuer, 4)) e.docIssuer = 'Орган, що видав — 4 цифри';
    if (!isDate(d.docValidUntil)) e.docValidUntil = 'Вкажіть, до якої дати дійсна';
  }
  if (!isDate(d.docIssuedAt)) e.docIssuedAt = 'Вкажіть дату видачі';
  if (d.address.length < 8) e.address = 'Вкажіть адресу проживання повністю';
  if (role === 'renter') {
    if (d.licenseNumber.length < 6) e.licenseNumber = 'Вкажіть серію й номер посвідчення';
    if (!isDate(d.licenseIssuedAt)) e.licenseIssuedAt = 'Вкажіть дату видачі';
    if (!isDate(d.licenseValidUntil)) e.licenseValidUntil = 'Вкажіть, до якої дати дійсне';
  } else if (d.ownership === 'proxy') {
    if (d.proxyNumber.length < 1) e.proxyNumber = 'Вкажіть номер довіреності';
    if (!isDate(d.proxyDate)) e.proxyDate = 'Вкажіть дату довіреності';
    if (d.proxyIssuer.length < 3) e.proxyIssuer = 'Вкажіть, хто посвідчив';
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
