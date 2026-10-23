import { api } from './api';

export type CatalogBrand = { id: number; name: string; modelsCount: number };
export type CatalogModel = {
  id: number;
  name: string;
  brandId: number;
  brand: string;
  yearFrom: number | null;
  yearTo: number | null;
  generationsCount: number;
};
export type CatalogModels = { total: number; items: CatalogModel[] };

// Повний список марок майже не змінюється: тримаємо його в пам'яті, щоб не питати сервер щоразу
let allBrands: Promise<CatalogBrand[]> | null = null;

export function fetchBrands(q = ''): Promise<CatalogBrand[]> {
  if (q) return api<CatalogBrand[]>('GET', `/catalog/brands?q=${encodeURIComponent(q)}`);
  allBrands ??= api<CatalogBrand[]>('GET', '/catalog/brands').catch((e) => {
    allBrands = null;
    throw e;
  });
  return allBrands;
}

export function fetchModels(brandId: number, q = ''): Promise<CatalogModels> {
  const params = new URLSearchParams({ brandId: String(brandId), limit: '200' });
  if (q) params.set('q', q);
  return api<CatalogModels>('GET', `/catalog/models?${params}`);
}

/** Знаходить id марки за назвою (для авто, збережених раніше без id) */
export async function lookupBrandId(name: string): Promise<number | null> {
  const brands = await fetchBrands(name);
  return brands.find((b) => b.name.toLowerCase() === name.toLowerCase())?.id ?? null;
}
