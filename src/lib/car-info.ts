import { formatKm } from './format';

/** Відтінок для кружечка кольору авто за назвою (українською); невідомий колір — без кружечка */
const COLORS: [RegExp, string][] = [
  [/біл/i, '#F4F4F4'],
  [/чорн/i, '#1F1F1F'],
  [/сір|графіт|антрацит/i, '#8E8E93'],
  [/срібл/i, '#C0C3C8'],
  [/червон|бордов|вишнев/i, '#D23B30'],
  [/синь|синій|блакит|голуб/i, '#2F6FDB'],
  [/зелен|салат|оливк|хакі/i, '#3E8E4D'],
  [/жовт|золот/i, '#E5B820'],
  [/помаранч/i, '#F08A24'],
  [/корич|шоколад/i, '#7A4A2B'],
  [/беж|пісоч|кремов/i, '#D8C3A0'],
  [/фіолет/i, '#7B4FB5'],
  [/рожев/i, '#E88FB0'],
];

export function colorHex(name?: string | null) {
  if (!name) return null;
  return COLORS.find(([rx]) => rx.test(name))?.[1] ?? null;
}

/** Важливе про авто одним рядком: колір, паливо, пробіг (без порожнього) */
export function carFacts(car: { color?: string | null; fuel?: string | null; mileage?: number | null }) {
  return [car.color, car.fuel, car.mileage ? formatKm(car.mileage) : null].filter(Boolean).join(' · ');
}
