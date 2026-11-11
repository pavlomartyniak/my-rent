import { BadRequestException, ConflictException, type ValidationError } from '@nestjs/common';

/**
 * Помилки з прив'язкою до поля форми: у тілі відповіді `fields` — {поле: текст}. Застосунок за ним підсвічує саме те поле.
 * Вкладені поля мають шлях через крапку (idDoc.number, license.validUntil). `message` лишається, як і раніше, масивом рядків.
 */
export type FieldIssue = { field: string; message: string };

const toFields = (issues: FieldIssue[]) => {
  const fields: Record<string, string> = {};
  for (const i of issues) fields[i.field] ??= i.message;
  return fields;
};

/** Перелік помилок валідації, кожна з полем: 400 */
export const badFields = (issues: FieldIssue[]) =>
  new BadRequestException({ statusCode: 400, error: 'Bad Request', message: issues.map((i) => i.message), fields: toFields(issues) });

/** Одна помилка в конкретному полі: 400 */
export const badField = (field: string, message: string) => badFields([{ field, message }]);

/** Конфлікт через конкретне поле (зайнятий телефон чи пошта): 409 */
export const conflictField = (field: string, message: string) =>
  new ConflictException({ statusCode: 409, error: 'Conflict', message, fields: { [field]: message } });

/** Розгортає дерево помилок class-validator у плоский перелік «поле → перше повідомлення» */
export function validationIssues(errors: ValidationError[], parent = ''): FieldIssue[] {
  const out: FieldIssue[] = [];
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const first = Object.values(e.constraints ?? {})[0];
    if (first) out.push({ field: path, message: first });
    if (e.children?.length) out.push(...validationIssues(e.children, path));
  }
  return out;
}

/** Фабрика для ValidationPipe: та сама відповідь 400, що й була, плюс `fields` */
export const validationFactory = (errors: ValidationError[]) => {
  const issues = validationIssues(errors);
  return badFields(issues.length ? issues : [{ field: '', message: 'Некоректні дані' }]);
};
