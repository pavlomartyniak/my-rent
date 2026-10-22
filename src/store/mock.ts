import { lastMonths, toISODate } from '@/lib/date';
import type { Car, Reminder, Transaction } from '@/types';

/** Усі місяці від січня 2024 до поточного включно */
const START_YEAR = 2024;
const now = new Date();
const months = lastMonths((now.getFullYear() - START_YEAR) * 12 + now.getMonth() + 1);
const day = (m: string, d: number) => `${m}-${String(d).padStart(2, '0')}`;

/** День платежу: у поточному місяці не пізніше сьогодні, щоб не було дат у майбутньому */
const payDay = (m: string, d: number) => (m === months[months.length - 1] ? Math.min(d, now.getDate()) : d);

const START = `${START_YEAR}-01`;

export const MOCK_CARS: Car[] = [
  { id: 'c1', brand: 'Toyota', model: 'Camry', year: 2019, vin: 'JTNB11HK3K3012345', mileage: 84200, rentStart: day(START, 3), price: 650_000, status: 'В оренді', driver: 'Олег К.' },
  { id: 'c2', brand: 'Skoda', model: 'Octavia', year: 2017, vin: 'TMBJG7NE8H0123456', mileage: 142500, rentStart: day(START, 10), price: 420_000, status: 'В оренді', driver: 'Андрій М.' },
  { id: 'c3', brand: 'Renault', model: 'Logan', year: 2015, vin: 'VF1LSRAF550123456', mileage: 201300, rentStart: day(START, 1), price: 210_000, status: 'В оренді', driver: 'Сергій Т.' },
  { id: 'c4', brand: 'Hyundai', model: 'Elantra', year: 2020, vin: 'KMHD35LH5LU123456', mileage: 61800, rentStart: day(START, 15), price: 520_000, status: 'В оренді', driver: 'Максим Л.' },
];

const DRIVERS: Record<string, string[]> = {
  c1: ['Олег К.'],
  c2: ['Андрій М.', 'Ігор П.'],
  c3: ['Сергій Т.'],
  c4: ['Максим Л.', 'Денис Р.'],
};

/** Місячна оренда кожного авто — щомісяця без пропусків (простою немає) */
const RATES: Record<string, number> = { c1: 24_000, c2: 16_000, c3: 9_500, c4: 19_000 };

const EXPENSES: { category: string; amount: number; note?: string }[] = [
  { category: 'ТО', amount: 4_200 },
  { category: 'Паливо', amount: 2_400 },
  { category: 'Ремонт', amount: 7_800, note: 'Підвіска' },
  { category: 'Страховка', amount: 9_800 },
  { category: 'Шини', amount: 12_000, note: 'Сезонна заміна' },
  { category: 'Ремонт', amount: 18_500, note: 'Заміна зчеплення' },
];

export const MOCK_TRANSACTIONS: Transaction[] = MOCK_CARS.flatMap((car, carIndex) =>
  months.flatMap((m, i): Transaction[] => {
    const drivers = DRIVERS[car.id];
    const list: Transaction[] = [
      {
        id: `i-${car.id}-${m}`,
        carId: car.id,
        type: 'income',
        amount: RATES[car.id] + ((i * 7 + carIndex * 3) % 5) * 500,
        date: day(m, payDay(m, 5)),
        category: 'Оренда',
        driver: drivers[Math.floor(i / 4) % drivers.length],
      },
    ];
    // Витрата раз на 2–3 місяці, зі зсувом по авто, щоб місяці не збігались
    if ((i + carIndex) % 3 === 0) {
      const e = EXPENSES[(i + carIndex * 2) % EXPENSES.length];
      list.push({
        id: `e-${car.id}-${m}`,
        carId: car.id,
        type: 'expense',
        amount: e.amount,
        date: day(m, payDay(m, 14)),
        category: e.category,
        note: e.note,
      });
    }
    return list;
  }),
);

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const MOCK_REMINDERS: Reminder[] = [
  { id: 'r1', carId: 'c1', kind: 'ТО', date: inDays(6), done: false },
  { id: 'r2', carId: 'c3', kind: 'Страховка', date: inDays(21), done: false },
  { id: 'r3', carId: 'c2', kind: 'ТО', date: inDays(-3), done: false },
];
