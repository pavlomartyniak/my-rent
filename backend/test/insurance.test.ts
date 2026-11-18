import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanFileName, policyExpired, sniffPolicy } from '../src/insurance/insurance.files';

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
