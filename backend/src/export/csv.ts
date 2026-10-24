/**
 * Побудова CSV, який коректно відкривається в Excel і Google Sheets.
 * Роздільник «;» — звичний для українських налаштувань Excel; BOM потрібен, щоб кирилиця не «ламалась».
 */

const DELIMITER = ';';
const BOM = '﻿';

/**
 * Екранування однієї клітинки. Окрім лапок і розділювачів, нейтралізуємо «CSV-ін'єкцію»:
 * клітинка, що починається з = + - @ або табуляції, у таблиці виконалась би як формула.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value !== 'number') text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return BOM + [header, ...rows].map((row) => row.map(csvCell).join(DELIMITER)).join('\r\n') + '\r\n';
}
