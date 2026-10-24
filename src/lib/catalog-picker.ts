import { router } from 'expo-router';

import type { CatalogBrand, CatalogModel } from './catalog';
import type { Place } from './places';

export type PickerRequest =
  | { kind: 'brand'; selected?: string; onSelect: (brand: CatalogBrand) => void }
  | { kind: 'model'; brandId: number; brandName: string; selected?: string; onSelect: (model: CatalogModel) => void }
  | { kind: 'place'; /** true — можна обрати і всю область (для фільтрів) */ allowRegion: boolean; selected?: string; onSelect: (place: Place) => void }
  | { kind: 'year'; years: number[]; selected?: number; hint?: string; onSelect: (year: number) => void };

// Форма відкриває екран вибору й передає йому функцію-відповідь. Так вибране значення
// повертається у форму без параметрів маршруту, а стан форми лишається в самій формі.
let pending: PickerRequest | null = null;

export function openCatalogPicker(request: PickerRequest) {
  pending = request;
  router.push('/car/pick');
}

export const getPickerRequest = () => pending;
