import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from '../src/auth/auth.dto';
import { badField, badFields, conflictField, validationFactory, validationIssues } from '../src/common/field-errors';

const body = (e: { getResponse(): unknown }) => e.getResponse() as { statusCode: number; message: string[]; fields: Record<string, string> };

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
  it('по батькові обов’язкове при реєстрації: без нього поле підсвічується', async () => {
    const dto = plainToInstance(RegisterDto, { firstName: 'Іван', lastName: 'Шевченко', email: 'a@b.co', password: 'password123', phone: '+380671234567' });
    const fields = Object.fromEntries(validationIssues(await validate(dto)).map((i) => [i.field, i.message]));
    assert.equal(fields.middleName, 'Вкажіть по батькові');
  });
  it('валідація DTO дає помилки по полях (реєстрація без телефону й з поганою поштою)', async () => {
    const dto = plainToInstance(RegisterDto, { firstName: 'Іван', lastName: 'Шевченко', middleName: 'Петрович', email: 'bad', password: 'password123', role: 'renter' });
    const issues = validationIssues(await validate(dto));
    const fields = Object.fromEntries(issues.map((i) => [i.field, i.message]));
    assert.equal(fields.email, 'Невірний формат email');
    assert.ok(fields.phone, 'телефон підсвічується');
    assert.ok(!('firstName' in fields));
  });
  it('validationFactory повертає 400 з fields і зворотно сумісним message', async () => {
    const dto = plainToInstance(RegisterDto, { firstName: '', lastName: 'Ш', middleName: '', email: 'a@b.co', password: 'short', phone: '+380671234567' });
    const r = body(validationFactory(await validate(dto)));
    assert.equal(r.statusCode, 400);
    assert.ok(Array.isArray(r.message) && r.message.length >= 2);
    assert.ok(r.fields.firstName && r.fields.password && r.fields.middleName);
  });
});
