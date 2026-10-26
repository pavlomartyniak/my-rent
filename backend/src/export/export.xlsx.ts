import ExcelJS from 'exceljs';

import { type ExportData, sumsByCar, sumsOf, TYPE_LABEL } from './export.types';

const MONEY = '#,##0.00';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5BFF' } };

/** Excel-книга: аркуш «Записи» (з рядком підсумків-формул) і «Підсумки» (по кожному авто) */
export async function renderXlsx(data: ExportData): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = 'Kolo';
  book.created = new Date();

  const sheet = book.addWorksheet('Записи', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Авто', key: 'car', width: 26 },
    { header: 'Тип', key: 'type', width: 10 },
    { header: 'Категорія', key: 'category', width: 18 },
    { header: 'Сума, ₴', key: 'amount', width: 14, style: { numFmt: MONEY } },
    { header: 'Водій', key: 'driver', width: 22 },
    { header: 'Примітка', key: 'note', width: 36 },
  ];
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = HEADER_FILL;

  for (const r of data.rows) {
    // Дата справжньою датою, щоб працювало сортування й зведені таблиці
    sheet.addRow({ ...r, date: new Date(`${r.date}T00:00:00Z`), type: TYPE_LABEL[r.type] });
  }
  sheet.getColumn('date').numFmt = 'dd.mm.yyyy';
  sheet.autoFilter = { from: 'A1', to: 'G1' };

  const last = data.rows.length + 1;
  if (data.rows.length) {
    const total = sheet.addRow({});
    total.getCell('type').value = 'Прибуток';
    total.getCell('amount').value = { formula: `SUMIF(C2:C${last},"Дохід",E2:E${last})-SUMIF(C2:C${last},"Витрата",E2:E${last})`, result: sumsOf(data.rows).profit };
    total.font = { bold: true };
    total.getCell('amount').numFmt = MONEY;
  }

  const summary = book.addWorksheet('Підсумки');
  summary.columns = [
    { header: 'Авто', key: 'car', width: 30 },
    { header: 'Доходи, ₴', key: 'income', width: 16, style: { numFmt: MONEY } },
    { header: 'Витрати, ₴', key: 'expense', width: 16, style: { numFmt: MONEY } },
    { header: 'Прибуток, ₴', key: 'profit', width: 16, style: { numFmt: MONEY } },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = HEADER_FILL;
  for (const { car, sums } of sumsByCar(data.rows)) summary.addRow({ car, ...sums });
  const all = sumsOf(data.rows);
  const totalRow = summary.addRow({ car: 'Разом', ...all });
  totalRow.font = { bold: true };

  return Buffer.from(await book.xlsx.writeBuffer());
}
