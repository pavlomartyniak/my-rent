/** Чисті правила чату, окремо від бази, щоб їх можна було тестувати */

export const MAX_MESSAGE_LENGTH = 2000;

/** Текст повідомлення без зайвих пробілів по краях і з обмеженою кількістю порожніх рядків; null — повідомлення порожнє */
export function cleanMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text ? text : null;
}

/** Чи прочитала сторона повідомлення, надіслане о `at`: вона відкривала чат після нього */
export function isRead(at: Date, otherReadAt?: Date | null) {
  return !!otherReadAt && otherReadAt.getTime() >= at.getTime();
}

/** Скільки повідомлень показати в списку: коротке прев'ю без переносів */
export function preview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
