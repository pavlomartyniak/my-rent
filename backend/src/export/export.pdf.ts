import { join } from 'node:path';

import PDFDocument from 'pdfkit';

import { type ExportData, type Sums, sumsByCar, sumsOf } from './export.types';

const FONT_DIR = join(__dirname, '..', '..', 'data', 'fonts');
const REGULAR = join(FONT_DIR, 'DejaVuSans.ttf');
const BOLD = join(FONT_DIR, 'DejaVuSans-Bold.ttf');

const money = (n: number) => `${n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
const whole = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** PDF-звіт: підсумки, підсумки по авто й таблиця всіх записів (кирилиця через шрифт DejaVu) */
export function renderExportPdf(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 48, left: 40, right: 40 }, info: { Title: data.title, Author: 'Kolo' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    doc.font(BOLD).fontSize(17).text(data.title);
    doc.font(REGULAR).fontSize(10).fillColor('#555555').text(data.subtitle).fillColor('#000000').moveDown(0.8);

    const totals = sumsOf(data.rows);
    const sumLine = (label: string, s: Sums) => {
      doc.font(BOLD).fontSize(10).text(label, { continued: true });
      doc.font(REGULAR).text(`   дохід ${whole(s.income)} · витрати ${whole(s.expense)} · `, { continued: true });
      doc.font(BOLD).fillColor(s.profit < 0 ? '#B3261E' : '#0A7A3E').text(`прибуток ${whole(s.profit)}`).fillColor('#000000');
    };
    sumLine('Разом', totals);

    const byCar = sumsByCar(data.rows);
    if (byCar.length > 1) {
      doc.moveDown(0.6);
      for (const { car, sums } of byCar) sumLine(car, sums);
    }
    doc.moveDown(1);

    // Таблиця записів: колонки з фіксованою шириною, шапка повторюється на кожній сторінці
    const cols = [
      { title: 'Дата', w: 0.13 },
      { title: 'Авто', w: 0.22 },
      { title: 'Категорія', w: 0.2 },
      { title: 'Водій / примітка', w: 0.27 },
      { title: 'Сума', w: 0.18, right: true },
    ].map((c) => ({ ...c, w: c.w * width }));

    const header = () => {
      const y = doc.y;
      doc.rect(left, y - 2, width, 18).fill('#2F5BFF');
      doc.fillColor('#FFFFFF').font(BOLD).fontSize(9);
      let x = left;
      for (const c of cols) {
        doc.text(c.title, x + 4, y + 2, { width: c.w - 8, align: c.right ? 'right' : 'left', lineBreak: false });
        x += c.w;
      }
      doc.fillColor('#000000');
      doc.y = y + 20;
    };

    if (data.rows.length === 0) {
      doc.font(REGULAR).fontSize(11).text('За цей період записів немає.');
    } else {
      header();
      data.rows.forEach((r, i) => {
        const memo = [r.driver, r.note].filter(Boolean).join(' · ');
        doc.font(REGULAR).fontSize(9);
        const h = Math.max(doc.heightOfString(memo, { width: cols[3].w - 8 }), doc.heightOfString(r.car, { width: cols[1].w - 8 }), 12) + 6;
        if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          header();
        }
        const y = doc.y;
        if (i % 2) doc.rect(left, y - 2, width, h).fill('#F2F4FA').fillColor('#000000');
        const cells = [day(r.date), r.car, r.category, memo, `${r.type === 'income' ? '+' : '−'}${money(r.amount)}`];
        let x = left;
        cells.forEach((text, k) => {
          const income = k === 4 && r.type === 'income';
          doc.fillColor(k === 4 ? (income ? '#0A7A3E' : '#B3261E') : '#000000').text(text, x + 4, y + 1, { width: cols[k].w - 8, align: cols[k].right ? 'right' : 'left' });
          x += cols[k].w;
        });
        doc.fillColor('#000000');
        doc.y = y + h;
      });
    }

    doc.end();
  });
}
