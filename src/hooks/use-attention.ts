import { useReport } from '@/hooks/use-report';
import { daysUntil } from '@/lib/date';
import type { DealView, PaymentQuestion } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';
import type { RentalView } from '@/lib/rentals';
import type { WantedView } from '@/lib/wanted';
import { useFleet } from '@/store/fleet';
import type { IconName } from '@/components/ui/icon';

/** Куди веде рядок «Потрібна ваша увага» */
export type AttentionTarget =
  | { kind: 'contract'; dealId: string }
  | { kind: 'deal'; dealId: string }
  | { kind: 'car'; carId: string }
  | { kind: 'tab'; href: string; params?: Record<string, string> }
  | { kind: 'release'; deal: DealView }
  | { kind: 'payment'; dealId: string; n: number };

export type AttentionItem = {
  key: string;
  /** urgent — потрібна дія зараз, info — можна подивитись пізніше */
  tone: 'urgent' | 'success' | 'warning' | 'info';
  icon: IconName;
  title: string;
  text: string;
  /** Підпис кнопки справа: що саме треба зробити */
  action: string;
  /** Скільки це додає до лічильника на вкладці (0 — лише інформація) */
  count: number;
  /** На якій вкладці показується число: «Головна» чи «Запити» (нові запити й пропозиції) */
  tab: 'home' | 'requests';
  target: AttentionTarget;
};

const POLL = { refetchOnFocus: true, pollMs: 300_000 } as const;

/**
 * Усе, що чекає на користувача, в одному списку: договори, відповіді на розірвання, нові запити чи пропозиції,
 * авто, яке пора звільнити, найближчі нагадування. Один список замість окремих банерів.
 */
export function useAttention(role: 'owner' | 'renter' | null) {
  const { reminders, cars } = useFleet();
  const owner = role === 'owner';
  const renter = role === 'renter';

  const signing = useReport<DealView[]>(role ? '/deals/awaiting-signature' : null, POLL).data ?? [];
  const termination = useReport<DealView[]>(role ? '/deals/termination-requests' : null, POLL).data ?? [];
  const requests = useReport<RentalView[]>(owner ? '/rentals/incoming?status=pending' : null, POLL).data ?? [];
  const offers = useReport<WantedView[]>(renter ? '/wanted/mine' : null, POLL).data ?? [];
  const release = useReport<DealView[]>(owner ? '/deals/awaiting-release' : null, POLL).data ?? [];
  const payments = useReport<PaymentQuestion[]>(role ? '/deals/awaiting-payment' : null, POLL).data ?? [];

  const items: AttentionItem[] = [];

  for (const d of signing.filter((x) => x.contract?.signing.state === 'open')) {
    items.push({ key: `sign-${d.id}`, tone: 'success', icon: 'create', title: 'Час підписати договір', action: 'Підписати', text: `${d.title}. Підписуйте під час зустрічі, коли передаєте авто, ключі й гроші`, count: 1, tab: 'home', target: { kind: 'contract', dealId: d.id } });
  }
  // Платежі за договором: «ви сплатили?» (орендар) чи «ви отримали?» (власник)
  for (const p of payments) {
    items.push({
      key: `pay-${p.dealId}-${p.n}`,
      tone: 'urgent',
      icon: 'cash',
      title: renter ? `Ви сплатили ${formatMoney(p.remaining)}?` : `Ви отримали ${formatMoney(p.remaining)}?`,
      text: `${p.title}${p.count > 1 ? `, платіж ${p.n} з ${p.count}` : ''}. Підтвердьте, щоб це потрапило в облік`,
      action: 'Відповісти',
      count: 1,
      tab: 'home',
      target: { kind: 'payment', dealId: p.dealId, n: p.n },
    });
  }
  for (const d of termination) {
    items.push({
      key: `term-${d.id}`,
      tone: 'urgent',
      icon: 'close-circle',
      title: 'Пропонують розірвати оренду',
      action: 'Відповісти',
      text: `${d.counterpart.name} · ${d.title}. Потрібна ваша відповідь`,
      count: 1,
      tab: 'home',
      target: owner ? { kind: 'car', carId: d.carId ?? '' } : { kind: 'deal', dealId: d.id },
    });
  }
  if (requests.length > 0) {
    items.push({
      key: 'requests',
      tone: 'urgent',
      icon: 'mail-unread',
      title: requests.length === 1 ? 'Новий запит на оренду' : `${requests.length} ${plural(requests.length, 'новий запит', 'нові запити', 'нових запитів')} на оренду`,
      action: 'Відповісти',
      text: 'Орендар чекає вашої відповіді',
      count: requests.length,
      tab: 'requests',
      target: { kind: 'tab', href: '/requests' },
    });
  }
  const offerCount = offers.reduce((sum, w) => sum + (w.offers?.pending ?? 0), 0);
  if (offerCount > 0) {
    items.push({
      key: 'offers',
      tone: 'urgent',
      icon: 'albums',
      title: offerCount === 1 ? 'Власник запропонував авто' : `${offerCount} ${plural(offerCount, 'пропозиція', 'пропозиції', 'пропозицій')} від власників`,
      action: 'Обрати',
      text: 'Перегляньте й оберіть найкращу',
      count: offerCount,
      tab: 'requests',
      target: { kind: 'tab', href: '/renter/requests', params: { tab: 'wanted' } },
    });
  }
  for (const d of release) {
    items.push({ key: `rel-${d.id}`, tone: 'warning', icon: 'checkmark-done-circle', title: 'Оренда закінчилась', text: `${d.title}. Звільнити авто?`, action: 'Звільнити', count: 0, tab: 'home', target: { kind: 'release', deal: d } });
  }
  // Найближче нагадування (лише для власника): ТО чи страховка, що вже горить
  if (owner) {
    const next = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date))[0];
    const days = next ? daysUntil(next.date) : Infinity;
    if (next && days <= 7) {
      const car = cars.find((c) => c.id === next.carId);
      items.push({
        key: `rem-${next.id}`,
        tone: days < 0 ? 'urgent' : 'warning',
        icon: 'alert-circle',
        title: `${next.kind}${car ? ` · ${car.brand} ${car.model}` : ''}`,
        action: 'Відкрити',
        text: days < 0 ? `Прострочено на ${-days} ${plural(-days, 'день', 'дні', 'днів')}` : days === 0 ? 'Сьогодні' : `Через ${days} ${plural(days, 'день', 'дні', 'днів')}`,
        count: 0,
        tab: 'home',
        target: { kind: 'tab', href: '/reminders' },
      });
    }
  }
  for (const d of signing.filter((x) => x.contract?.signing.state === 'early')) {
    items.push({ key: `sign-early-${d.id}`, tone: 'info', icon: 'document-text', title: 'Договір сформовано', action: 'Переглянути', text: `${d.title}. Перегляньте його, підписувати — при зустрічі`, count: 0, tab: 'home', target: { kind: 'contract', dealId: d.id } });
  }

  /** Числа для вкладок: лише те, що потребує дії */
  const sum = (tab: AttentionItem['tab']) => items.filter((i) => i.tab === tab).reduce((n, i) => n + i.count, 0);
  return { items, home: sum('home'), requests: sum('requests'), urgent: items.filter((i) => i.tone !== 'info').length };
}
