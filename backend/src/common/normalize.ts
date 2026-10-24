/**
 * Нижній регістр і прибрана діакритика латиниці (Škoda → skoda), розділові знаки → пробіли.
 * Кирилицю не чіпаємо: інакше «Київ» збігався б із «Киів» (ї → і, й → и).
 */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/(?<=\p{Script=Latin})[\u0300-\u036f]+/gu, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Екранує текст для використання всередині регулярного виразу */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
