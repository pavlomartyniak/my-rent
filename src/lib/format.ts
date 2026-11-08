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

/** 14 → «1 р. 2 міс» */
export function formatMonths(n: number) {
  const years = Math.floor(n / 12);
  const months = n % 12;
  return [years ? `${years} р.` : '', months ? `${months} міс` : ''].filter(Boolean).join(' ') || '< 1 міс';
}

/** Ініціали для аватара: перші літери двох перших слів імені */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** «Volkswagen Golf 2011» → назва й рік окремо; без року в кінці лишається вся назва */
export function splitTitle(title: string) {
  const m = title.match(/^(.*\S)\s+(\d{4})$/);
  return m ? { name: m[1]!, year: m[2]! } : { name: title, year: '' };
}
