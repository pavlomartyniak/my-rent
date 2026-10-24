import { Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalize } from '../common/normalize';
import { BRAND_ALIASES } from './catalog.aliases';

type RawGeneration = { id: number; name: string; year_from: number | null; year_to: number | null };
type RawModel = RawGeneration & { generations: RawGeneration[] };
type RawBrand = { id: number; name: string; models: RawModel[] };
type RawCatalog = { source: string; collected_at: string; note: string; counts: Record<string, number>; brands: RawBrand[] };

export type Generation = { id: number; name: string; yearFrom: number | null; yearTo: number | null };
export type ModelSummary = { id: number; name: string; brandId: number; brand: string; yearFrom: number | null; yearTo: number | null; generationsCount: number };
export type ModelDetails = ModelSummary & { generations: Generation[] };

type IndexedModel = { summary: ModelSummary; generations: Generation[]; search: string };
type IndexedBrand = { id: number; name: string; search: string; models: IndexedModel[] };

/** Усі слова запиту мають зустрічатися в тексті */
const matches = (search: string, tokens: string[]) => tokens.every((t) => search.includes(t));
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });

/**
 * Каталог марок і моделей (дані AUTO.RIA, файл data/autoria-catalog.json).
 * Завантажується в пам'ять при старті, пошук без звернень до бази.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly log = new Logger(CatalogService.name);
  private brands: IndexedBrand[] = [];
  private brandsById = new Map<number, IndexedBrand>();
  private modelsById = new Map<number, IndexedModel>();
  /** Усі моделі, відсортовані за назвою (марка + модель) — для пошуку по всьому каталогу */
  private allModels: IndexedModel[] = [];

  onModuleInit() {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'autoria-catalog.json'), 'utf8')) as RawCatalog;

    for (const b of raw.brands) {
      // Марки без моделей вибрати все одно неможливо
      if (!b.models.length) continue;
      const aliases = BRAND_ALIASES[b.name] ?? [];
      const brand: IndexedBrand = { id: b.id, name: b.name, search: normalize([b.name, ...aliases].join(' ')), models: [] };

      for (const m of b.models) {
        if (this.modelsById.has(m.id)) continue;
        const generations = m.generations.map((g) => ({ id: g.id, name: g.name, yearFrom: g.year_from, yearTo: g.year_to }));
        const model: IndexedModel = {
          summary: { id: m.id, name: m.name, brandId: b.id, brand: b.name, yearFrom: m.year_from, yearTo: m.year_to, generationsCount: generations.length },
          generations,
          search: normalize(`${[b.name, ...aliases].join(' ')} ${m.name}`),
        };
        brand.models.push(model);
        this.modelsById.set(m.id, model);
      }
      brand.models.sort((a, c) => byName(a.summary, c.summary));
      if (!this.brandsById.has(b.id)) {
        this.brands.push(brand);
        this.brandsById.set(b.id, brand);
      }
    }
    this.brands.sort(byName);
    this.allModels = this.brands.flatMap((b) => b.models);
    this.log.log(`Каталог: ${this.brands.length} марок, ${this.modelsById.size} моделей (${raw.source}, ${raw.collected_at})`);
  }

  brandsList(q?: string) {
    const tokens = normalize(q ?? '').split(' ').filter(Boolean);
    return this.brands
      .filter((b) => matches(b.search, tokens))
      .sort((a, b) => this.rank(a.search, tokens) - this.rank(b.search, tokens) || byName(a, b))
      .map((b) => ({ id: b.id, name: b.name, modelsCount: b.models.length }));
  }

  modelsList(opts: { brandId?: number; q?: string; limit?: number }) {
    let pool = this.allModels;
    if (opts.brandId !== undefined) {
      const brand = this.brandsById.get(opts.brandId);
      if (!brand) throw new NotFoundException('Марку не знайдено');
      pool = brand.models;
    }
    const tokens = normalize(opts.q ?? '').split(' ').filter(Boolean);
    const found = pool.filter((m) => matches(m.search, tokens));
    // Спершу ті, що починаються з запиту; порядок за назвою зберігається
    found.sort((a, b) => this.rank(a.search, tokens) - this.rank(b.search, tokens));
    return { total: found.length, items: found.slice(0, opts.limit ?? 50).map((m) => m.summary) };
  }

  model(id: number): ModelDetails {
    const m = this.modelsById.get(id);
    if (!m) throw new NotFoundException('Модель не знайдено');
    return { ...m.summary, generations: m.generations };
  }

  /** 0 — текст починається з першого слова запиту, 1 — лише містить */
  private rank(search: string, tokens: string[]) {
    return tokens.length && search.startsWith(tokens[0]) ? 0 : 1;
  }
}
