import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '@/lib/api';
import type { MarketCar, MarketPage } from '@/lib/rentals';

type Loaded = { key: string; page: number; pages: number; total: number; items: MarketCar[]; error?: string };

/**
 * Пошук оголошень із відкладеним запитом (300 мс після останнього символу) і підвантаженням сторінок.
 * Зміна фільтрів скидає список на першу сторінку.
 */
export type MarketFilters = { brand?: string; model?: string; fuel?: string };

export function useMarketSearch(city: string | undefined, regionId: number | undefined, minPrice: string, maxPrice: string, extra: MarketFilters = {}) {
  const [debounced, setDebounced] = useState({ minPrice: '', maxPrice: '' });
  const [attempt, setAttempt] = useState(0);
  const [want, setWant] = useState({ key: '', page: 1 });
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ minPrice, maxPrice }), 300);
    return () => clearTimeout(timer);
  }, [minPrice, maxPrice]);

  const key = `${city ?? ''}|${regionId ?? ''}|${debounced.minPrice}|${debounced.maxPrice}|${extra.brand ?? ''}|${extra.model ?? ''}|${extra.fuel ?? ''}|${attempt}`;
  const page = want.key === key ? want.page : 1;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (city) params.set('city', city);
    else if (regionId !== undefined) params.set('regionId', String(regionId));
    if (extra.brand) params.set('brand', extra.brand);
    if (extra.model) params.set('model', extra.model);
    if (extra.fuel) params.set('fuel', extra.fuel);
    if (Number(debounced.minPrice) > 0) params.set('minPrice', debounced.minPrice);
    if (Number(debounced.maxPrice) > 0) params.set('maxPrice', debounced.maxPrice);

    api<MarketPage>('GET', `/market/cars?${params}`)
      .then((res) => {
        if (cancelled) return;
        setLoaded((prev) => ({
          key,
          page: res.page,
          pages: res.pages,
          total: res.total,
          // Наступні сторінки дописуються до вже показаних, перша — замінює список
          items: prev && prev.key === key && res.page > 1 ? [...prev.items, ...res.items] : res.items,
        }));
      })
      .catch((e) => {
        if (!cancelled) setLoaded({ key, page: 1, pages: 1, total: 0, items: [], error: e instanceof ApiError ? e.message : 'Не вдалося завантажити оголошення' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, city, regionId, page, attempt, key]);

  const current = loaded?.key === key ? loaded : null;
  const shown = current ?? loaded;

  return {
    items: shown?.items ?? [],
    total: shown?.total ?? 0,
    error: current?.error,
    /** true, поки немає відповіді для поточних фільтрів або довантажується наступна сторінка */
    loading: !current || current.page < page,
    hasMore: !!current && current.page < current.pages,
    loadMore: useCallback(() => setWant({ key, page: page + 1 }), [key, page]),
    refresh: useCallback(() => setAttempt((n) => n + 1), []),
  };
}
