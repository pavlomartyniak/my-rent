import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openChat } from '@/lib/chat';
import { contactActions } from '@/lib/contact-actions';
import { daysUntil, formatDate } from '@/lib/date';
import { dealStage, type DealOverview, type DealView } from '@/lib/deals';
import { formatMoney, plural } from '@/lib/format';
import type { Totals } from '@/lib/reports';

import { CarPhoto } from './car-photo';
import { ContactChips } from './contact-chips';
import { ContractCard } from './contract-card';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon, type IconName } from './ui/icon';

type Props = {
  deal: DealView;
  /** Підсумки за поточний місяць і за весь час; без них показуємо лише умови */
  month?: Totals;
  overview?: DealOverview;
};

/** «Volkswagen Golf 2011» → назва й рік окремо; без року в кінці лишається вся назва */
function splitTitle(title: string) {
  const m = title.match(/^(.*\S)\s+(\d{4})$/);
  return m ? { name: m[1]!, year: m[2]! } : { name: title, year: '' };
}

/** Велика кнопка дії: іконка над підписом */
function Action({ icon, title, tone, onPress }: { icon: IconName; title: string; tone: 'positive' | 'negative' | 'neutral'; onPress: () => void }) {
  const theme = useTheme();
  const [bg, fg] = { positive: [theme.positiveSoft, theme.positive], negative: [theme.negativeSoft, theme.negative], neutral: [theme.backgroundSelected, theme.text] }[tone];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: bg }, pressed && styles.pressed]}>
      <Icon name={icon} size={24} color={fg} />
      <ThemedText type="smallBold" style={{ color: fg }} numberOfLines={1}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Авто, яке я зараз орендую: фото зі станом, скільки діб лишилось і прогрес оренди, прибуток за місяць,
 * баланс платежів власнику та швидкі дії (записати заробіток чи витрату, написати власнику).
 */
export function ActiveDealCard({ deal, month, overview }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const stage = dealStage(deal);
  const { name, year } = splitTitle(deal.title);
  const left = overview ? Math.max(0, overview.totalDays - overview.elapsedDays) : undefined;
  const progress = overview && overview.totalDays > 0 ? Math.min(1, overview.elapsedDays / overview.totalDays) : 0;
  const add = (type: 'income' | 'expense') => router.push({ pathname: '/transaction/new', params: { dealId: deal.id, type } });

  const balance = overview?.rentBalance ?? 0;
  const balanceLabel = !overview ? 'Оренда' : balance > 0 ? 'Борг за оренду' : balance < 0 ? 'Оренда наперед' : 'Оренда';
  const balanceText = !overview ? '—' : balance === 0 ? 'Сплачено' : formatMoney(Math.abs(balance));

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button">
          {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
          <View style={styles.top}>
            <CarPhoto uri={deal.photoUri} style={styles.photo} iconSize={32} />
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.title} numberOfLines={2}>
                {name}
              </ThemedText>
              <View style={styles.meta}>
                <StatusBadge status={stage} dot />
                {year ? (
                  <ThemedText type="default" themeColor="textSecondary">
                    {year}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <Icon name="chevron-forward" size={20} color="textSecondary" />
          </View>
        </Pressable>
      </Link>

      {stage === 'signing' ? (
        <>
          <ContractCard deal={deal} as="renter" />
          <ContactChips actions={contactActions({ chat: { dealId: deal.id } })} />
        </>
      ) : (
        <>
          <View style={[styles.panel, { backgroundColor: theme.accentSoft }]}>
            <View style={styles.between}>
              <View>
                <ThemedText type="smallBold" themeColor="accent">
                  {stage === 'upcoming' ? 'Починається через' : 'Залишилось'}
                </ThemedText>
                <ThemedText style={styles.big} themeColor="accent">
                  {stage === 'upcoming'
                    ? `${daysUntil(deal.startDate)} ${plural(daysUntil(deal.startDate), 'доба', 'доби', 'діб')}`
                    : left !== undefined
                      ? `${left} ${plural(left, 'доба', 'доби', 'діб')}`
                      : '—'}
                </ThemedText>
              </View>
              <View style={styles.dates}>
                <ThemedText type="small" themeColor="textSecondary">
                  з {formatDate(deal.startDate)}
                </ThemedText>
                <ThemedText type="smallBold">до {formatDate(deal.endDate)}</ThemedText>
              </View>
            </View>
            {stage === 'active' && overview ? (
              <View style={[styles.track, { backgroundColor: `${theme.accent}33` }]}>
                <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(2, Math.round(progress * 100))}%` }]} />
              </View>
            ) : null}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                За місяць
              </ThemedText>
              <ThemedText style={styles.statValue} themeColor={!month || month.profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(month?.profit ?? 0)}
              </ThemedText>
            </View>
            <View style={[styles.sep, { backgroundColor: theme.border }]} />
            <View style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary">
                {balanceLabel}
              </ThemedText>
              <ThemedText style={styles.statValue} themeColor={balance > 0 ? 'negative' : 'positive'} numberOfLines={1} adjustsFontSizeToFit>
                {balanceText}
              </ThemedText>
            </View>
          </View>

          <View style={styles.actions}>
            <Action icon="add" title="Заробіток" tone="positive" onPress={() => add('income')} />
            <Action icon="remove" title="Витрата" tone="negative" onPress={() => add('expense')} />
            <Action icon="chatbubble-ellipses-outline" title="Написати" tone="neutral" onPress={() => void openChat({ dealId: deal.id })} />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.three, borderRadius: 28 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photo: { width: 106, height: 80, borderRadius: Radius.md },
  flex: { flex: 1, gap: Spacing.two },
  title: { fontWeight: 700, fontSize: 20, lineHeight: 26 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  panel: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  big: { fontSize: 34, lineHeight: 42, fontWeight: 700, letterSpacing: -0.5 },
  dates: { alignItems: 'flex-end', gap: 2 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.one },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  sep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minHeight: 72, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
