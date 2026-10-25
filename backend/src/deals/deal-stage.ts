/**
 * Етап оренди за статусом і датами: підписується договір, ще не почалась, триває, завершилась чи розірвана
 * достроково. Оренда починається лише після того, як обидві сторони підписали договір.
 */
export type DealStage = 'signing' | 'upcoming' | 'active' | 'finished' | 'terminated';

export function dealStageOf(deal: { status?: string; startDate: string; endDate: string }, today: string): DealStage {
  if (deal.status === 'terminated') return 'terminated';
  if (deal.status === 'awaiting') return 'signing';
  if (today > deal.endDate) return 'finished';
  return today < deal.startDate ? 'upcoming' : 'active';
}
