const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toISODate(d) === value;
}

/** 'YYYY-MM' */
export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** Останні n місяців (включно з поточним), від старішого до новішого */
export function lastMonths(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

export function monthLabel(key: string) {
  // Стовпчик року (графік за весь час) підписується самим роком
  if (key.length === 4) return key;
  return MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function daysUntil(iso: string, now = new Date()) {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

const MONTHS_FULL = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

/** 'YYYY-MM' → 'Жовтень 2026' */
export function monthTitle(key: string) {
  if (key.length === 4) return key;
  return `${MONTHS_FULL[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
}

/** Зсув 'YYYY-MM' на delta місяців */
export function shiftMonth(key: string, delta: number) {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function fromISODate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

const WEEKDAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function weekdayShort(iso: string) {
  return WEEKDAYS_SHORT[fromISODate(iso).getDay()];
}
