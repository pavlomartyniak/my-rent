import { Share } from 'react-native';

import type { Car, Transaction } from '@/types';

const esc = (v: string | number | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function transactionsToCsv(cars: Car[], txs: Transaction[]) {
  const name = (id: string) => {
    const c = cars.find((x) => x.id === id);
    return c ? `${c.brand} ${c.model}` : '';
  };
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) =>
      [t.date, name(t.carId), t.type === 'income' ? 'Дохід' : 'Витрата', t.category, t.amount, t.driver, t.note]
        .map(esc)
        .join(','),
    );
  return ['Дата,Авто,Тип,Категорія,Сума,Водій,Примітка', ...rows].join('\n');
}

export async function shareCsv(cars: Car[], txs: Transaction[]) {
  await Share.share({ title: 'my-rent.csv', message: transactionsToCsv(cars, txs) });
}
