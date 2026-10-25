/** Етап оренди за статусом і датами: ще не почалась, триває, завершилась чи розірвана достроково */
export type DealStage = 'upcoming' | 'active' | 'finished' | 'terminated';

export function dealStageOf(deal: { status?: string; startDate: string; endDate: string }, today: string): DealStage {
  if (deal.status === 'terminated') return 'terminated';
  if (today > deal.endDate) return 'finished';
  return today < deal.startDate ? 'upcoming' : 'active';
}
