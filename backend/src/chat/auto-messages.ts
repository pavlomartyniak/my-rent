/** Тексти автоматичних повідомлень у чаті: так розмова починається одразу, а не лише з картки запиту чи пропозиції */

const money = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} грн`;
const date = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const plural = (n: number) => (n % 100 >= 11 && n % 100 <= 14 ? 'діб' : n % 10 === 1 ? 'доба' : n % 10 >= 2 && n % 10 <= 4 ? 'доби' : 'діб');
const withNote = (text: string, note?: string) => (note?.trim() ? `${text}\n\n${note.trim()}` : text);

/** Орендар надіслав запит на оголошення */
export function requestMessage(i: { title: string; startDate: string; endDate: string; days: number; total: number; note?: string }) {
  return withNote(`Добрий день! Хочу орендувати ${i.title} з ${date(i.startDate)} по ${date(i.endDate)} (${i.days} ${plural(i.days)}, орієнтовно ${money(i.total)}).`, i.note);
}

/** Власник запропонував авто на заявку орендаря */
export function offerMessage(i: { title: string; startDate: string; endDate: string; days: number; pricePerDay: number; total: number; note?: string }) {
  return withNote(`Добрий день! Пропоную ${i.title} на ваші дати ${date(i.startDate)} – ${date(i.endDate)}: ${money(i.pricePerDay)} за добу, ${i.days} ${plural(i.days)}, разом ${money(i.total)}.`, i.note);
}

/** Запит чи пропозицію прийнято: договір вже сформовано */
export function acceptedMessage(i: { startDate: string }) {
  return `Домовленість прийнято ✅ Договір сформовано, його можна переглянути в застосунку. Підписуємо при зустрічі, коли передаємо авто, ключі й гроші: підписання відкриється ${date(shiftDay(i.startDate, -1))}.`;
}

function shiftDay(iso: string, days: number) {
  return new Date(new Date(`${iso}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
