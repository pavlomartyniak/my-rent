/**
 * Юридичні дані сторони договору (форма «Дані для договору»). Перевіряє їх сервер, тут лише типи й підписи:
 * правила не дублюються, щоб застосунок і сервер не розійшлися.
 */
export type PartyType = 'individual' | 'fop';
export type IdDocType = 'passport_book' | 'id_card';

export type LegalProfile = {
  partyType: PartyType;
  kved?: string;
  middleName: string;
  rnokpp: string;
  idDoc: { type: IdDocType; series: string; number: string; issuedBy: string; issuedAt: string };
  address: string;
  license?: { series: string; number: string; categories: string[]; /** Строк дії, YYYY-MM-DD */ validUntil: string };
};

export const PARTY_LABELS: Record<PartyType, string> = { individual: 'Фізична особа', fop: 'ФОП' };
export const ID_DOC_LABELS: Record<IdDocType, string> = { id_card: 'ID-картка', passport_book: 'Паспорт-книжка' };
export const LICENSE_CATEGORIES = ['A1', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'BE', 'C1E', 'CE', 'D1E', 'DE', 'T'] as const;
