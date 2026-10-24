import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { csvCell, toCsv } from '../src/export/csv';

describe('csvCell', () => {
  it('звичайний текст і числа без змін', () => {
    assert.equal(csvCell('Оренда'), 'Оренда');
    assert.equal(csvCell(24000.5), '24000.5');
  });
  it('порожнє значення — порожня клітинка', () => {
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(undefined), '');
  });
  it('розділювач, лапки й переноси рядка беруться в лапки', () => {
    assert.equal(csvCell('а;б'), '"а;б"');
    assert.equal(csvCell('він сказав "так"'), '"він сказав ""так"""');
    assert.equal(csvCell('рядок1\nрядок2'), '"рядок1\nрядок2"');
  });
  it('кома не потребує лапок (роздільник — крапка з комою)', () => assert.equal(csvCell('а, б'), 'а, б'));
  it('нейтралізує формули (CSV-ін’єкція)', () => {
    assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
    assert.equal(csvCell('+380671234567'), "'+380671234567");
    assert.equal(csvCell('-5'), "'-5");
    assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(csvCell('\tтаб'), "'\tтаб");
  });
  it('від’ємне число не вважається формулою', () => assert.equal(csvCell(-500), '-500'));
});

describe('toCsv', () => {
  it('BOM, заголовок, рядки через CRLF й кінцевий перенос', () => {
    const csv = toCsv(['Дата', 'Сума'], [['2026-10-05', 24000], ['2026-10-06', 1500.5]]);
    assert.equal(csv, '﻿Дата;Сума\r\n2026-10-05;24000\r\n2026-10-06;1500.5\r\n');
  });
  it('без рядків — лише заголовок', () => assert.equal(toCsv(['A'], []), '﻿A\r\n'));
});
