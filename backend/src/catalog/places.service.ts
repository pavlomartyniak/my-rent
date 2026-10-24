import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalize } from '../common/normalize';

type RawPlaces = { source: string; collected_at: string; states: { id: number; name: string; cities: { id: number; name: string }[] }[] };

export type Region = { id: number; name: string; citiesCount: number };
export type City = { id: number; name: string; regionId: number; region: string };

type IndexedCity = City & { search: string };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' });

/**
 * Довідник областей і міст України (дані AUTO.RIA, файл data/autoria-places.json).
 * Завантажується в пам'ять при старті; з нього обирають місто в оголошеннях, заявках і пошуку.
 */
@Injectable()
export class PlacesService implements OnModuleInit {
  private readonly log = new Logger(PlacesService.name);
  private regions: Region[] = [];
  private citiesByRegion = new Map<number, IndexedCity[]>();
  private all: IndexedCity[] = [];

  onModuleInit() {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'autoria-places.json'), 'utf8')) as RawPlaces;
    const seen = new Set<number>();
    for (const s of raw.states) {
      const region = `${s.name} область`;
      const cities = s.cities
        .filter((c) => !seen.has(c.id) && seen.add(c.id))
        .map((c): IndexedCity => ({ id: c.id, name: c.name, regionId: s.id, region, search: normalize(c.name) }))
        .sort(byName);
      this.citiesByRegion.set(s.id, cities);
      this.regions.push({ id: s.id, name: region, citiesCount: cities.length });
      this.all.push(...cities);
    }
    this.regions.sort(byName);
    this.all.sort(byName);
    this.log.log(`Місця: ${this.regions.length} областей, ${this.all.length} міст (${raw.source}, ${raw.collected_at})`);
  }

  regionsList() {
    return this.regions;
  }

  /** Міста області або всієї країни; `q` — пошук за назвою міста (слова в будь-якому порядку) */
  citiesList(opts: { regionId?: number; q?: string; limit?: number }) {
    let pool = this.all;
    if (opts.regionId !== undefined) {
      const cities = this.citiesByRegion.get(opts.regionId);
      if (!cities) throw new NotFoundException('Область не знайдено');
      pool = cities;
    }
    const tokens = normalize(opts.q ?? '').split(' ').filter(Boolean);
    const found = pool.filter((c) => tokens.every((t) => c.search.includes(t)));
    // Спершу ті, що починаються з запиту; порядок за назвою зберігається
    if (tokens.length) found.sort((a, b) => Number(!a.search.startsWith(tokens[0])) - Number(!b.search.startsWith(tokens[0])));
    return { total: found.length, items: found.slice(0, opts.limit ?? 50).map(({ search: _search, ...c }) => c) };
  }

  /** Ключі (нормалізовані назви) усіх міст області — для фільтра «уся область» */
  cityKeysOfRegion(regionId: number): string[] {
    const cities = this.citiesByRegion.get(regionId);
    if (!cities) throw new NotFoundException('Область не знайдено');
    return [...new Set(cities.map((c) => c.search))];
  }
}
