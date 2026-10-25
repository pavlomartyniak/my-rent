export type ExportRow = { date: string; car: string; type: 'income' | 'expense'; category: string; amount: number; driver: string; note: string };

export type ExportData = {
  /** Назва файлу без розширення */
  name: string;
  /** Заголовок і підзаголовок звіту (для PDF і Excel) */
  title: string;
  subtitle: string;
  rows: ExportRow[];
};

export const TYPE_LABEL = { income: 'Дохід', expense: 'Витрата' } as const;

export type Sums = { income: number; expense: number; profit: number };

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumsOf(rows: ExportRow[]): Sums {
  let income = 0;
  let expense = 0;
  for (const r of rows) r.type === 'income' ? (income += r.amount) : (expense += r.amount);
  return { income: round2(income), expense: round2(expense), profit: round2(income - expense) };
}

/** Підсумки по кожному авто (у порядку першої появи) */
export function sumsByCar(rows: ExportRow[]): { car: string; sums: Sums }[] {
  const groups = new Map<string, ExportRow[]>();
  for (const r of rows) groups.set(r.car, [...(groups.get(r.car) ?? []), r]);
  return [...groups].map(([car, list]) => ({ car, sums: sumsOf(list) }));
}
