import { escapeRegex, normalize } from '../common/normalize';

/** Чисті правила збігу заявок орендарів з автопарком власника, окремо від бази, щоб їх можна було тестувати */

type CarKey = { brand: string; model: string };
type WantedKey = { brand: string; model: string };

/** Авто підходить під заявку: порожня марка чи модель у заявці означає «будь-яка» */
export function carMatches(wanted: WantedKey, car: CarKey): boolean {
  const brand = normalize(wanted.brand);
  const model = normalize(wanted.model);
  if (brand && brand !== normalize(car.brand)) return false;
  if (model && model !== normalize(car.model)) return false;
  return true;
}

/**
 * Умови Mongo для заявок, під які в автопарку є вільне авто. Назви порівнюються без урахування регістру,
 * бо марки й моделі беруться з одного довідника, але раніше могли вводитись вручну.
 */
export function wantedConditionsFor(cars: CarKey[]): Record<string, unknown>[] {
  const exact = (value: string) => ({ $regex: `^${escapeRegex(value.trim())}$`, $options: 'i' });
  const brands = [...new Set(cars.map((c) => c.brand.trim()))].filter(Boolean);
  return [
    // «Будь-яке авто»: підходить, якщо є хоч одне вільне
    { brand: '' },
    // «Будь-яка модель цієї марки»
    ...brands.map((brand) => ({ brand: exact(brand), model: '' })),
    // Конкретна марка й модель
    ...cars.filter((c) => c.brand.trim() && c.model.trim()).map((c) => ({ brand: exact(c.brand), model: exact(c.model) })),
  ];
}
