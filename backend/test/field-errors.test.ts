import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from '../src/auth/auth.dto';
import { badField, badFields, conflictField, validationFactory, validationIssues } from '../src/common/field-errors';
import { identityIssues, licenseIssues, type LegalProfile } from '../src/common/legal';

const body = (e: { getResponse(): unknown }) => e.getResponse() as { statusCode: number; message: string[]; fields: Record<string, string> };
const TODAY = '2026-11-12';

describe('помилки з полями', () => {
  it('badFields: message — масив, fields — перше повідомлення кожного поля', () => {
    const r = body(badFields([{ field: 'phone', message: 'a' }, { field: 'phone', message: 'b' }, { field: 'email', message: 'c' }]));
    assert.equal(r.statusCode, 400);
    assert.deepEqual(r.message, ['a', 'b', 'c']);
    assert.deepEqual(r.fields, { phone: 'a', email: 'c' });
  });
  it('badField і conflictField', () => {
    assert.deepEqual(body(badField('plate', 'Вкажіть номер')).fields, { plate: 'Вкажіть номер' });
    const c = body(conflictField('phone', 'Цей номер телефону вже використовується'));
    assert.equal(c.statusCode, 409);
    assert.equal(c.message as unknown as string, 'Цей номер телефону вже використовується');
    assert.deepEqual(c.fields, { phone: 'Цей номер телефону вже використовується' });
  });
  it('валідація DTO дає помилки по полях (реєстрація без телефону й з поганою поштою)', async () => {
    const dto = plainToInstance(RegisterDto, { firstName: 'Іван', lastName: 'Шевченко', email: 'bad', password: 'password123', role: 'renter' });
    const issues = validationIssues(await validate(dto));
    const fields = Object.fromEntries(issues.map((i) => [i.field, i.message]));
    assert.equal(fields.email, 'Невірний формат email');
    assert.ok(fields.phone, 'телефон підсвічується');
    assert.ok(!('firstName' in fields));
  });
  it('validationFactory повертає 400 з fields і зворотно сумісним message', async () => {
    const dto = plainToInstance(RegisterDto, { firstName: '', lastName: 'Ш', email: 'a@b.co', password: 'short', phone: '+380671234567' });
    const r = body(validationFactory(await validate(dto)));
    assert.equal(r.statusCode, 400);
    assert.ok(Array.isArray(r.message) && r.message.length >= 2);
    assert.ok(r.fields.firstName && r.fields.password);
  });
});

describe('поля у помилках даних для договору', () => {
  const good: LegalProfile = { partyType: 'individual', middleName: 'Петрович', rnokpp: '3000000008', idDoc: { type: 'id_card', series: '', number: '123456789', issuedBy: '1234', issuedAt: '2022-05-01' }, address: 'м. Київ, вул. Хрещатик, 1, кв. 2' };
  it('кожна помилка прив’язана до свого поля форми', () => {
    const issues = identityIssues({ ...good, middleName: '', rnokpp: '123', idDoc: { ...good.idDoc, number: '1', issuedBy: '', issuedAt: '' }, address: 'x' }, TODAY);
    assert.deepEqual(issues.map((i) => i.field).sort(), ['address', 'idDoc.issuedAt', 'idDoc.issuedBy', 'idDoc.number', 'middleName', 'rnokpp']);
  });
  it('паспорт-книжка: серія й номер — окремі поля', () => {
    const issues = identityIssues({ ...good, idDoc: { type: 'passport_book', series: '1', number: '12', issuedBy: '1234', issuedAt: '2022-05-01' } }, TODAY);
    assert.deepEqual(issues.map((i) => i.field), ['idDoc.series', 'idDoc.number']);
  });
  it('посвідчення: серія, номер, строк дії', () => {
    assert.deepEqual(licenseIssues(undefined, TODAY).map((i) => i.field), ['license.series', 'license.number', 'license.validUntil']);
    assert.deepEqual(licenseIssues({ series: 'ААА', number: '123456', validUntil: '2020-01-01' }, TODAY).map((i) => i.field), ['license.validUntil']);
    assert.deepEqual(licenseIssues({ series: 'ААА', number: '123456', validUntil: '2030-01-01' }, TODAY), []);
  });
});
