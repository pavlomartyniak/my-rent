/**
 * Оцінки після оренди: зірки 1–5 і короткі теги з фіксованого списку (вільного тексту немає, тож модерувати нічого).
 * Теги залежать від того, кого оцінюють: власника чи орендаря.
 */
export const OWNER_TAGS = ['Авто як в описі', 'Чесний', 'Швидко відповідає', 'Гнучкий', 'Чисте авто'] as const;
export const RENTER_TAGS = ['Пунктуальний', 'Платить вчасно', 'Бережливий до авто', 'Завжди на зв’язку', 'Повернув чистим'] as const;

export const tagsFor = (targetRole: 'owner' | 'renter'): readonly string[] => (targetRole === 'owner' ? OWNER_TAGS : RENTER_TAGS);

export type RatingSummary = { count: number; avg: number | null; tags: { tag: string; count: number }[] };

/** Середня оцінка (до десятих) і три найчастіші теги */
export function summarize(rows: { rating: number; tags?: string[] }[]): RatingSummary {
  if (!rows.length) return { count: 0, avg: null, tags: [] };
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  const avg = rows.reduce((n, r) => n + r.rating, 0) / rows.length;
  return {
    count: rows.length,
    avg: Math.round(avg * 10) / 10,
    tags: [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'uk')).slice(0, 3),
  };
}
