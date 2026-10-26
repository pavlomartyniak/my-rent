import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BASE_URL, getApiToken } from './api';

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';
/** Звужує вибірку: авто (власник), оренда (орендар), період РРРР-ММ чи РРРР; без нічого — увесь облік */
export type ExportFilter = { carId?: string; dealId?: string; period?: string };

export const EXPORT_FORMATS: { format: ExportFormat; title: string; hint: string; mime: string; uti: string }[] = [
  { format: 'xlsx', title: 'Excel (.xlsx)', hint: 'Таблиця з підсумками по авто', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uti: 'org.openxmlformats.spreadsheetml.sheet' },
  { format: 'pdf', title: 'PDF', hint: 'Звіт для друку чи бухгалтера', mime: 'application/pdf', uti: 'com.adobe.pdf' },
  { format: 'csv', title: 'CSV', hint: 'Для Google Таблиць та інших програм', mime: 'text/csv', uti: 'public.comma-separated-values-text' },
];

/** Завантажує файл обліку із сервера (з токеном) у кеш і відкриває «Поділитись»: звідти його можна зберегти чи надіслати */
export async function exportFile(format: ExportFormat, filter: ExportFilter = {}) {
  const meta = EXPORT_FORMATS.find((f) => f.format === format)!;
  const query = new URLSearchParams(Object.entries(filter).filter((e): e is [string, string] => !!e[1])).toString();

  const dir = new Directory(Paths.cache, 'exports');
  dir.create({ idempotent: true });
  // Назву файлу дає сервер, тож завантажуємо під сталою і прибираємо стару копію
  const target = new File(dir, `kolo-${filter.period ?? 'all'}.${format}`);
  if (target.exists) target.delete();

  const task = File.createDownloadTask(`${BASE_URL}/export/transactions.${format}${query ? `?${query}` : ''}`, target, {
    headers: { Authorization: `Bearer ${getApiToken() ?? ''}` },
  });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Не вдалося завантажити файл');
  if (!(await Sharing.isAvailableAsync())) throw new Error('На цьому пристрої не можна поділитись файлом');
  await Sharing.shareAsync(file.uri, { mimeType: meta.mime, UTI: meta.uti, dialogTitle: 'Експорт обліку' });
}
