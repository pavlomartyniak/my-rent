import { Share } from 'react-native';

import { api } from './api';

/** Завантажує CSV із сервера й відкриває меню «Поділитися». `carId` і `period` звужують вибірку. */
export async function exportCsv(filter: { carId?: string; period?: string } = {}) {
  const query = new URLSearchParams(Object.entries(filter).filter((e): e is [string, string] => !!e[1])).toString();
  const csv = await api<string>('GET', `/export/transactions.csv${query ? `?${query}` : ''}`, undefined, { text: true });
  await Share.share({ title: 'my-rent.csv', message: csv });
}
