/**
 * Дані авто для договору: державний номер (обов'язковий) і колір (необов'язковий). Особисті дані сторін (паспорт, РНОКПП,
 * адреса, посвідчення водія, поліс) застосунок не збирає: у договорі для них залишено рядки для вписування.
 */
export type CarLegal = { plate: string; color: string };

const CYR = 'А-ЯІЇЄҐ';
const PLATE = new RegExp(`^[${CYR}A-Z0-9]{4,10}$`);

const cap = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
const compact = (s: unknown) => String(s ?? '').trim().toUpperCase().slice(0, 20).replace(/[\s-]/g, '');

/** Державний номер у єдиному вигляді: великі літери, без пробілів і дефісів; колір — обрізаний */
export function normalizeCarLegal(input: Partial<CarLegal>): CarLegal {
  return { plate: compact(input.plate), color: cap(input.color, 30) };
}

/** Державний номер має допустимий вигляд */
export const plateValid = (plate: unknown) => PLATE.test(compact(plate));
