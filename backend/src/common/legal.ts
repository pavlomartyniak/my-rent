/**
 * Юридичні дані сторони договору й авто. Потрібні, щоб у договорі були визначені сторони й предмет: ПІБ повністю, РНОКПП,
 * документ про особу, адреса, для водія — посвідчення, для авто — держномер і свідоцтво про реєстрацію. Чисті правила без бази.
 */
export const PARTY_TYPES = ['individual', 'fop'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const ID_DOC_TYPES = ['passport_book', 'id_card'] as const;
export type IdDocType = (typeof ID_DOC_TYPES)[number];

/** Категорії посвідчення водія */
export const LICENSE_CATEGORIES = ['A1', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'BE', 'C1E', 'CE', 'D1E', 'DE', 'T'] as const;

export type LegalProfile = {
  /** Статус сторони: фізична особа чи ФОП; записується в договір (п. 1.3) */
  partyType: PartyType;
  /** Основний КВЕД ФОП, 49.32 */
  kved?: string;
  /** По батькові: разом з ім'ям і прізвищем дає ПІБ повністю */
  middleName: string;
  /** РНОКПП (ІПН), 10 цифр */
  rnokpp: string;
  idDoc: { type: IdDocType; series: string; number: string; issuedBy: string; issuedAt: string };
  address: string;
  /** Посвідчення водія: обов'язкове для орендаря; validUntil — строк дії, YYYY-MM-DD */
  license?: { series: string; number: string; categories: string[]; validUntil: string };
};

/** Дані авто для договору: державний номер, свідоцтво про реєстрацію й колір */
export type CarLegal = { plate: string; regCertificate: string; color: string };

const CYR = 'А-ЯІЇЄҐ';
const SERIES_BOOK = new RegExp(`^[${CYR}]{2}$`);
const SERIES_LICENSE = new RegExp(`^[${CYR}A-Z]{2,3}$`);
const REG_CERT = new RegExp(`^[${CYR}A-Z]{2,4}\\d{6}$`);
const PLATE = new RegExp(`^[${CYR}A-Z0-9]{4,10}$`);

const cap = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const up = (s: unknown) => (typeof s === 'string' ? s.trim().toUpperCase() : '');
const compact = (s: unknown) => up(s).slice(0, 20).replace(/[\s-]/g, '');

/** РНОКПП: 10 цифр, остання — контрольна (вага -1,5,7,9,4,6,10,5,7; сума mod 11 mod 10) */
export function rnokppValid(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const w = [-1, 5, 7, 9, 4, 6, 10, 5, 7];
  const sum = w.reduce((n, k, i) => n + k * Number(value[i]), 0);
  return ((sum % 11) + 11) % 11 % 10 === Number(value[9]);
}

const isPastIso = (iso: string, today: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) && iso <= today && iso >= '1950-01-01';

/** Приводить введене до єдиного вигляду (регістр, пробіли) і відкидає зайві поля */
export function normalizeLegal(input: Partial<LegalProfile> & Record<string, unknown>): LegalProfile {
  const doc = (input.idDoc ?? {}) as Partial<LegalProfile['idDoc']>;
  const lic = input.license as Partial<NonNullable<LegalProfile['license']>> | undefined;
  const type = ID_DOC_TYPES.includes(doc.type as IdDocType) ? (doc.type as IdDocType) : 'id_card';
  const partyType: PartyType = input.partyType === 'fop' ? 'fop' : 'individual';
  return {
    partyType,
    ...(partyType === 'fop' ? { kved: cap(input.kved, 10) } : {}),
    middleName: cap(input.middleName, 50),
    rnokpp: cap(input.rnokpp, 20).replace(/\s/g, ''),
    idDoc: {
      type,
      series: type === 'passport_book' ? compact(doc.series) : '',
      number: cap(doc.number, 20).replace(/\s/g, ''),
      issuedBy: cap(doc.issuedBy, 120),
      issuedAt: cap(doc.issuedAt, 10),
    },
    address: cap(input.address, 200),
    ...(normalizeLicense(lic) ? { license: normalizeLicense(lic)! } : {}),
  };
}

/** Посвідчення водія в єдиному вигляді; undefined, якщо нічого не введено */
export function normalizeLicense(input: Partial<NonNullable<LegalProfile['license']>> | undefined | null): NonNullable<LegalProfile['license']> | undefined {
  if (!input || (!input.series && !input.number && !input.categories?.length && !input.validUntil)) return undefined;
  return {
    series: compact(input.series),
    number: cap(input.number, 20).replace(/\s/g, ''),
    categories: [...new Set((input.categories ?? []).slice(0, 20).map((c) => up(c)))],
    validUntil: cap(input.validUntil, 10),
  };
}

/** Що не так з посвідченням водія (серія, номер, категорії, строк дії); порожній список — усе гаразд */
export function licenseProblems(raw: LegalProfile['license'] | undefined | null, today: string): string[] {
  const l = normalizeLicense(raw);
  const out: string[] = [];
  if (!l || !SERIES_LICENSE.test(l.series)) out.push('Серія посвідчення водія: 2–3 літери');
  if (!l || !/^\d{6}$/.test(l.number)) out.push('Номер посвідчення водія: 6 цифр');
  if (!l || !l.categories.length || l.categories.some((c) => !(LICENSE_CATEGORIES as readonly string[]).includes(c))) out.push('Оберіть категорії посвідчення водія');
  if (!l || !/^\d{4}-\d{2}-\d{2}$/.test(l.validUntil) || Number.isNaN(Date.parse(l.validUntil))) out.push('Вкажіть, до якої дати діє посвідчення водія');
  else if (l.validUntil < today) out.push('Посвідчення водія прострочено: оновіть його дані');
  return out;
}

/** Що не так з даними сторони, окрім посвідчення водія */
export function identityProblems(raw: LegalProfile | undefined | null, today: string): string[] {
  if (!raw || !(raw as Partial<LegalProfile>).rnokpp) return ['Заповніть дані для договору'];
  const p = normalizeLegal(raw as never);
  const out: string[] = [];
  if (!p.middleName) out.push('Вкажіть по батькові');
  if (!rnokppValid(p.rnokpp)) out.push('РНОКПП: 10 цифр, перевірте номер');
  if (p.partyType === 'fop' && !/^\d{2}\.\d{2}$/.test(p.kved ?? '')) out.push('Вкажіть основний КВЕД у форматі 49.32');
  const d = p.idDoc;
  if (d.type === 'passport_book') {
    if (!SERIES_BOOK.test(d.series)) out.push('Серія паспорта: дві українські літери');
    if (!/^\d{6}$/.test(d.number)) out.push('Номер паспорта: 6 цифр');
  } else if (!/^\d{9}$/.test(d.number)) out.push('Номер ID-картки: 9 цифр');
  if (d.issuedBy.length < 3) out.push('Вкажіть, ким виданий документ');
  if (!isPastIso(d.issuedAt, today)) out.push('Вкажіть дату видачі документа');
  if (p.address.length < 10) out.push('Вкажіть адресу проживання повністю');
  return out;
}

/** Що не так з даними: список зрозумілих пунктів, порожній — усе гаразд. needLicense — для орендаря (водія) */
export function legalProblems(raw: LegalProfile | undefined | null, opts: { needLicense: boolean; today: string }): string[] {
  const out = identityProblems(raw, opts.today);
  if (opts.needLicense) out.push(...licenseProblems(raw?.license, opts.today));
  return out;
}

export function normalizeCarLegal(input: Partial<CarLegal>): CarLegal {
  return { plate: compact(input.plate), regCertificate: compact(input.regCertificate), color: cap(input.color, 30) };
}

/** Державний номер у єдиному вигляді (великі літери, без пробілів) має допустимий вигляд */
export const plateValid = (plate: unknown) => PLATE.test(compact(plate));

export function carProblems(car: Partial<CarLegal> | undefined | null): string[] {
  const c = normalizeCarLegal(car ?? {});
  const out: string[] = [];
  if (!PLATE.test(c.plate)) out.push('Вкажіть державний номер авто');
  if (!REG_CERT.test(c.regCertificate)) out.push('Вкажіть серію й номер свідоцтва про реєстрацію (ТЕХ 123456)');
  if (c.color.length < 3) out.push('Вкажіть колір авто');
  return out;
}

/** Посвідчення водія має діяти до кінця оренди; null — усе гаразд */
export function licenseCoversRental(legal: Pick<LegalProfile, 'license'> | undefined | null, endDate: string): string | null {
  const until = legal?.license?.validUntil;
  if (!until) return null;
  if (until < endDate) return `Посвідчення водія діє до ${until.split('-').reverse().join('.')}, а оренда закінчується ${endDate.split('-').reverse().join('.')}. Оновіть дані посвідчення або оберіть коротший строк`;
  return null;
}

/** Підпис статусу сторони для тексту договору */
export const partyTypeLabel = (p: Pick<LegalProfile, 'partyType' | 'kved'>) => (p.partyType === 'fop' ? `ФОП${p.kved ? `, КВЕД ${p.kved}` : ''}` : 'фізична особа');

export const idDocLabel = (d: LegalProfile['idDoc']) =>
  `${d.type === 'passport_book' ? `паспорт серії ${d.series} № ${d.number}` : `ID-картка № ${d.number}`}, виданий ${d.issuedBy} ${d.issuedAt.split('-').reverse().join('.')}`;
