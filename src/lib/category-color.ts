/**
 * Колір категорії витрат на діаграмах. Відомі категорії мають свій постійний колір, щоб «Паливо» чи «Ремонт» скрізь
 * виглядали однаково; решта береться з палітри за порядком. Кольори підібрано так, щоб читались і на світлій, і на темній темі.
 */
const PALETTE = ['#4F46E5', '#8E86FF', '#E5484D', '#2DB87A', '#F5A524', '#38A8E0', '#B15DDC', '#E0719C'] as const;
const NEUTRAL = '#8A8F98';

const FIXED: Record<string, string> = {
  'Оренда авто': PALETTE[0],
  Паливо: PALETTE[1],
  Ремонт: PALETTE[2],
  Мийка: PALETTE[3],
  Штраф: PALETTE[4],
  ТО: PALETTE[5],
  Страховка: PALETTE[6],
  Шини: PALETTE[7],
  Інше: NEUTRAL,
};

export const categoryColor = (category: string, index: number) => FIXED[category] ?? PALETTE[index % PALETTE.length];
