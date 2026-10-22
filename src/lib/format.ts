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
