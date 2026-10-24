import { api } from './api';

export type Region = { id: number; name: string; citiesCount: number };
export type City = { id: number; name: string; regionId: number; region: string };
export type Cities = { total: number; items: City[] };

/** Вибране місце: місто або вся область (лише у фільтрах) */
export type Place = { city?: string; regionId?: number; label: string };

// Області майже не змінюються: тримаємо їх у пам'яті, щоб не питати сервер щоразу
let regions: Promise<Region[]> | null = null;

export function fetchRegions(): Promise<Region[]> {
  regions ??= api<Region[]>('GET', '/catalog/regions').catch((e) => {
    regions = null;
    throw e;
  });
  return regions;
}

export function fetchCities(opts: { regionId?: number; q?: string }): Promise<Cities> {
  const params = new URLSearchParams({ limit: '200' });
  if (opts.regionId !== undefined) params.set('regionId', String(opts.regionId));
  if (opts.q) params.set('q', opts.q);
  return api<Cities>('GET', `/catalog/cities?${params}`);
}
