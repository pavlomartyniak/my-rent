import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanFileName, extractSignedPdf, normalizePolicy, policyExpired, sniffPolicy } from '../src/insurance/insurance.files';

const pad = (b: number[], n = 16) => Buffer.concat([Buffer.from(b), Buffer.alloc(n)]);

describe('вид файлу полісу', () => {
  it('PDF, JPEG, PNG, WebP й HEIC визначаються за початком файлу', () => {
    assert.equal(sniffPolicy(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj')), 'application/pdf');
    assert.equal(sniffPolicy(Buffer.concat([Buffer.from('\uFEFF\r\n'), Buffer.from('%PDF-1.5\n1 0 obj')])), 'application/pdf');
    assert.equal(sniffPolicy(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
    assert.equal(sniffPolicy(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
    assert.equal(sniffPolicy(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'image/webp');
    assert.equal(sniffPolicy(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(8)])), 'image/heic');
  });

  it('виконуваний файл чи текст під виглядом полісу не проходить', () => {
    assert.equal(sniffPolicy(Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000')), null);
    assert.equal(sniffPolicy(Buffer.from('<html><script>alert(1)</script></html>')), null);
    assert.equal(sniffPolicy(Buffer.from('%PDF')), null);
    assert.equal(sniffPolicy(Buffer.from('<html>' + 'x'.repeat(1100) + '%PDF-1.4 ...')), null);
  });
});

describe('назва файлу й строк дії', () => {
  it('назва без шляхів і керівних символів', () => {
    assert.equal(cleanFileName('../../etc/passwd'), '.._.._etc_passwd');
    assert.equal(cleanFileName('   '), 'Страховий поліс');
    assert.equal(cleanFileName('a'.repeat(300)).length, 120);
  });

  it('поліс прострочений лише після дати «діє до»', () => {
    assert.equal(policyExpired('2026-11-17', '2026-11-18'), true);
    assert.equal(policyExpired('2026-11-18', '2026-11-18'), false);
    assert.equal(policyExpired(undefined, '2026-11-18'), false);
  });
});

describe('назва від multer', () => {
  it('кирилиця, прочитана як latin1, відновлюється', async () => {
    const { fixMulterName } = await import('../src/insurance/insurance.files');
    const garbled = Buffer.from('Поліс КАСКО.pdf', 'utf8').toString('latin1');
    assert.equal(fixMulterName(garbled), 'Поліс КАСКО.pdf');
    assert.equal(fixMulterName('policy.pdf'), 'policy.pdf');
    assert.equal(fixMulterName('Поліс.pdf'), 'Поліс.pdf');
  });
});

/** Мінімальний цілісний PDF із правильними зсувами таблиці xref */
function tinyPdf() {
  const parts: string[] = [];
  const offsets: number[] = [];
  const add = (t: string) => parts.push(t);
  const len = () => parts.join('').length;
  add('%PDF-1.4\n');
  offsets.push(len());
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets.push(len());
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offsets.push(len());
  add('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>\nendobj\n');
  const xref = len();
  add(`xref\n0 4\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(parts.join(''), 'latin1');
}

describe('підписаний контейнер із PDF усередині', () => {
  const pdf = tinyPdf();
  // Схоже на CMS: SEQUENCE, OID signedData, далі PDF як OCTET STRING і підписи
  const wrap = (inner: Buffer) => Buffer.concat([Buffer.from([0x30, 0x82, 0x03, 0x10, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02, 0x04, 0x82, 0x01, 0x00]), inner, Buffer.from([0xa0, 0x82, 0x01, 0x22, 0x30, 0x82, 0x01, 0x1e])]);

  it('такий контейнер не вважається PDF, але PDF з нього дістається цілим', () => {
    const container = wrap(pdf);
    assert.equal(sniffPolicy(container), null);
    const out = extractSignedPdf(container);
    assert.ok(out && out.equals(pdf));
    const norm = normalizePolicy(container);
    assert.equal(norm?.mime, 'application/pdf');
    assert.ok(norm?.data.equals(pdf));
  });

  it('якщо PDF у контейнері пошкоджений чи розбитий, його не приймаємо', () => {
    const broken = Buffer.from(pdf.toString('latin1').replace(/startxref\n\d+/, 'startxref\n99999'), 'latin1');
    assert.equal(extractSignedPdf(wrap(broken)), null);
    assert.equal(normalizePolicy(Buffer.from([0x30, 0x82, 0x00, 0x10, ...Buffer.from('no pdf here at all')])), null);
  });

  it('звичайний PDF і фото проходять як є', () => {
    assert.ok(normalizePolicy(pdf)?.data.equals(pdf));
    assert.equal(normalizePolicy(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]))?.mime, 'image/jpeg');
  });
});
