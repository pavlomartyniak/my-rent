export const CURRENCY = '₴';

export function formatMoney(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '−' : ''}${abs} ${CURRENCY}`;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function formatKm(value: number) {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} км`;
}

/** Українська множина: plural(5, 'модель', 'моделі', 'моделей') → «моделей» */
export function plural(n: number, one: string, few: string, many: string) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** '650000' → '650 000' (нерозривні пробіли між тисячами), для полів вводу */
export function groupDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}
