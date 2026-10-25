import { join } from 'node:path';

import PDFDocument from 'pdfkit';

import { methodLabel, type Signature } from './contract.signing';
import { buildSections, CONTRACT_DISCLAIMER, type ContractTerms } from './contract.terms';

const FONT_DIR = join(__dirname, '..', '..', 'data', 'fonts');
const REGULAR = join(FONT_DIR, 'DejaVuSans.ttf');
const BOLD = join(FONT_DIR, 'DejaVuSans-Bold.ttf');

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

export type ContractSignatures = { owner?: Signature | null; renter?: Signature | null };

/** PDF договору з українським текстом (шрифт DejaVu із кирилицею), підписами сторін і відбитком умов */
export function renderContractPdf(terms: ContractTerms, hash: string, signatures: ContractSignatures): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 64, right: 64 }, info: { Title: `Договір оренди № ${terms.number}`, Author: 'my-rent' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font(BOLD).fontSize(15).text('ДОГОВІР ОРЕНДИ ТРАНСПОРТНОГО ЗАСОБУ', { align: 'center' });
    doc.font(BOLD).fontSize(12).text(`№ ${terms.number}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.font(REGULAR).fontSize(10).fillColor('#333333').text(`${terms.city || 'Україна'}, ${terms.createdAt.slice(8, 10)}.${terms.createdAt.slice(5, 7)}.${terms.createdAt.slice(0, 4)}`, { align: 'center' });
    doc.fillColor('#000000').moveDown(1);

    for (const section of buildSections(terms)) {
      doc.font(BOLD).fontSize(11.5).text(section.title, { paragraphGap: 3 });
      doc.font(REGULAR).fontSize(10.5);
      for (const p of section.paragraphs) {
        // Застереження про шаблон виділяємо меншим сірим шрифтом
        if (p.startsWith('Договір сформовано застосунком')) doc.fontSize(9).fillColor('#555555').text(p, { align: 'justify', paragraphGap: 4 }).fillColor('#000000').fontSize(10.5);
        else doc.text(p, { align: 'justify', paragraphGap: 4 });
      }
      doc.moveDown(0.6);
    }

    // Блок підписів не розривається між сторінками
    if (doc.y > doc.page.height - 260) doc.addPage();
    doc.font(BOLD).fontSize(11.5).text('Підписи Сторін', { paragraphGap: 6 });
    const block = (label: string, name: string, sig?: Signature | null) => {
      doc.font(BOLD).fontSize(10.5).text(`${label}: ${name}`);
      if (sig) {
        doc.font(REGULAR).fontSize(10).fillColor('#0A7A3E').text(`Підписано електронно ${stamp(sig.at)}`);
        doc.fillColor('#333333').text(`Спосіб: ${methodLabel(sig.method)}. Ідентифікатор підпису: ${sig.signatureId}`);
      } else {
        doc.font(REGULAR).fontSize(10).fillColor('#B45309').text('Очікує підпису');
      }
      doc.fillColor('#000000').moveDown(0.8);
    };
    block('Орендодавець', terms.owner.name, signatures.owner);
    block('Орендар', terms.renter.name, signatures.renter);

    doc.moveDown(0.5);
    doc.font(REGULAR).fontSize(8).fillColor('#666666').text(`Відбиток умов договору (SHA-256): ${hash}`, { align: 'left' });
    doc.text(CONTRACT_DISCLAIMER, { align: 'left' });
    doc.end();
  });
}
