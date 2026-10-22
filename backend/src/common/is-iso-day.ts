import { registerDecorator, type ValidationOptions } from 'class-validator';

/** Дата у форматі YYYY-MM-DD, яка реально існує (відсікає 2026-02-31) */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function IsIsoDay(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isIsoDay',
      target: object.constructor,
      propertyName,
      options: { message: 'Дата має бути у форматі РРРР-ММ-ДД', ...options },
      validator: { validate: isIsoDay },
    });
}
