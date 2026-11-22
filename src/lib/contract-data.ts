import { api } from './api';

/** Дані для договору (документ, РНОКПП, адреса). Зберігаються на сервері зашифрованими; правила перевірки ті самі, що на сервері */
export type DocType = 'passport' | 'id';
export type Ownership = 'owner' | 'proxy';

export type LegalData = {
  birthDate: string;
  taxId: string;
  docType: DocType;
  docSeries: string;
  docNumber: string;
  docIssuer: string;
  docIssuedAt: string;
  docValidUntil: string;
  address: string;
  licenseNumber: string;
  licenseIssuedAt: string;
  licenseValidUntil: string;
  ownership: Ownership;
  proxyNumber: string;
  proxyDate: string;
  proxyIssuer: string;
};

export const EMPTY_LEGAL: LegalData = {
  birthDate: '', taxId: '', docType: 'passport', docSeries: '', docNumber: '', docIssuer: '', docIssuedAt: '', docValidUntil: '', address: '',
  licenseNumber: '', licenseIssuedAt: '', licenseValidUntil: '', ownership: 'owner', proxyNumber: '', proxyDate: '', proxyIssuer: '',
};

export type LegalState = { data: LegalData; saved: boolean; complete: boolean; consent: boolean; consentVersion: number };

export const getLegal = () => api<LegalState>('GET', '/legal/me');
export const saveLegal = (data: LegalData) => api<LegalState>('PUT', '/legal/me', { data, consent: true });
export const deleteLegal = () => api<LegalState>('DELETE', '/legal/me');

const iso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const digits = (s: string, n: number) => new RegExp(`^\\d{${n}}$`).test(s);

export type LegalStep = 'person' | 'document' | 'address' | 'extra';

/** Поля кожного кроку: за ними майстер визначає, чи можна йти далі, і куди повернути, якщо сервер знайшов помилку */
export const STEP_FIELDS: Record<LegalStep, (keyof LegalData)[]> = {
  person: ['birthDate', 'taxId'],
  document: ['docType', 'docSeries', 'docNumber', 'docIssuer', 'docIssuedAt', 'docValidUntil'],
  address: ['address'],
  extra: ['licenseNumber', 'licenseIssuedAt', 'licenseValidUntil', 'ownership', 'proxyNumber', 'proxyDate', 'proxyIssuer'],
};

/** Що не так з даними (поле → пояснення); порожній об'єкт — усе гаразд */
export function legalProblems(d: LegalData, role: 'owner' | 'renter'): Partial<Record<keyof LegalData, string>> {
  const e: Partial<Record<keyof LegalData, string>> = {};
  const today = new Date().toISOString().slice(0, 10);
  if (!iso(d.birthDate) || d.birthDate > today) e.birthDate = 'Вкажіть дату народження';
  else if (new Date().getFullYear() - Number(d.birthDate.slice(0, 4)) < 18) e.birthDate = 'Договір укладають з 18 років';
  if (!digits(d.taxId, 10)) e.taxId = 'РНОКПП — 10 цифр';
  if (d.docType === 'passport') {
    if (!/^[А-ЯІЇЄҐA-Z]{2}$/.test(d.docSeries.toUpperCase())) e.docSeries = 'Серія — 2 літери';
    if (!digits(d.docNumber, 6)) e.docNumber = 'Номер — 6 цифр';
    if (d.docIssuer.trim().length < 3) e.docIssuer = 'Вкажіть, ким виданий';
  } else {
    if (!digits(d.docNumber, 9)) e.docNumber = 'Номер ID-картки — 9 цифр';
    if (!digits(d.docIssuer, 4)) e.docIssuer = 'Орган, що видав, — 4 цифри';
    if (!iso(d.docValidUntil)) e.docValidUntil = 'Вкажіть, до якої дати дійсна';
  }
  if (!iso(d.docIssuedAt)) e.docIssuedAt = 'Вкажіть дату видачі';
  if (d.address.trim().length < 8) e.address = 'Вкажіть адресу проживання повністю';
  if (role === 'renter') {
    if (d.licenseNumber.trim().length < 6) e.licenseNumber = 'Вкажіть серію й номер посвідчення';
    if (!iso(d.licenseIssuedAt)) e.licenseIssuedAt = 'Вкажіть дату видачі';
    if (!iso(d.licenseValidUntil)) e.licenseValidUntil = 'Вкажіть, до якої дати дійсне';
  } else if (d.ownership === 'proxy') {
    if (!d.proxyNumber.trim()) e.proxyNumber = 'Вкажіть номер довіреності';
    if (!iso(d.proxyDate)) e.proxyDate = 'Вкажіть дату довіреності';
    if (d.proxyIssuer.trim().length < 3) e.proxyIssuer = 'Вкажіть, хто посвідчив';
  }
  return e;
}

export const stepOk = (d: LegalData, role: 'owner' | 'renter', step: LegalStep) => !STEP_FIELDS[step].some((k) => legalProblems(d, role)[k]);

/** Маска для показу на екрані перевірки: самі дані не світимо */
export const mask = (s: string, keep = 2) => (s.length <= keep ? s : `${'•'.repeat(Math.max(s.length - keep, 3))}${s.slice(-keep)}`);
