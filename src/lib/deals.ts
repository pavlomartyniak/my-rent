import { todayISO } from '@/lib/date';
import type { CategoryShare, SeriesPoint, Totals } from '@/lib/reports';

/** Відповіді ендпоінтів /deals і /reports/renter: оренди орендаря та його облік */

export type DealView = {
  id: string;
  /** Авто, яке здано (для власника) */
  carId?: string;
  title: string;
  photoUri?: string;
  city: string;
  pricePerDay: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  source: 'request' | 'offer';
  /** awaiting — чекаємо підписів під договором, active — договір підписано, terminated — розірвано чи скасовано */
  status: 'awaiting' | 'active' | 'terminated';
  /** Договір: номер і хто підписав; null — оренда створена до появи договорів */
  contract: { number: string; signed: { owner: boolean; renter: boolean }; mySigned: boolean; signedAt: string | null; signing: { opensAt: string; closesAt: string; state: 'early' | 'open' | 'late' } } | null;
  /** Пропозиція розірвати оренду, що чекає відповіді; mine — подав її я */
  terminationRequest: { by: 'owner' | 'renter'; at: string; note: string; mine: boolean } | null;
  terminatedBy?: 'owner' | 'renter' | 'system';
  terminatedAt?: string;
  terminationNote: string;
  /** Для орендаря — власник, для власника — орендар */
  counterpart: { name: string; phone?: string };
};

export type DealOverview = Totals & {
  /** Сплачено власнику за оренду */
  rentPaid: number;
  /** Скільки мало бути сплачено на сьогодні: ціна за добу × минулі доби */
  rentDue: number;
  /** Більше нуля — борг, менше — переплата */
  rentBalance: number;
  plannedRent: number;
  otherExpenses: number;
  elapsedDays: number;
  totalDays: number;
  avgProfitPerDay: number;
};

type WithMargin = Totals & { margin: number | null };

export type RenterSummary = {
  period: string;
  previousPeriod: string;
  totals: WithMargin;
  previous: WithMargin;
  change: { profit: number | null; income: number | null; expense: number | null; marginPoints: number | null };
  series: SeriesPoint[];
  categories: CategoryShare[];
  rentPaidTotal: number;
  deals: { dealId: string; period: Totals; overview: DealOverview }[];
};

export type DealReport = {
  dealId: string;
  period: string;
  totals: WithMargin;
  series: SeriesPoint[];
  categories: CategoryShare[];
  allCategories: CategoryShare[];
  overview: DealOverview;
};

export type DealStage = 'signing' | 'upcoming' | 'active' | 'finished' | 'terminated';

/** Оренда ще не почалась, триває, завершилась чи розірвана достроково */
export function dealStage(d: Pick<DealView, 'startDate' | 'endDate'> & { status?: string }, today = todayISO()): DealStage {
  if (d.status === 'terminated') return 'terminated';
  if (d.status === 'awaiting') return 'signing';
  return today < d.startDate ? 'upcoming' : today > d.endDate ? 'finished' : 'active';
}
