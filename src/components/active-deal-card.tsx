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

/** Кнопка дії: іконка й підпис в один рядок; без підпису (`label` лише для скрінрідерів) вона вужча й квадратна */
function Action({ icon, title, tone, label, onPress }: { icon: IconName; title?: string; tone: 'positive' | 'negative' | 'accent'; label?: string; onPress: () => void }) {
  const theme = useTheme();
  const [bg, fg] = { positive: [theme.positiveSoft, theme.positive], negative: [theme.negativeSoft, theme.negative], accent: [theme.accentSoft, theme.accent] }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, !title && styles.actionIcon, { backgroundColor: bg }, pressed && styles.pressed]}>
      <Icon name={icon} size={title ? 20 : 24} color={fg} />
      {title ? (
        <ThemedText type="default" style={{ color: fg, fontWeight: 600, fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** Біла плашка на фото */
function Pill({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
}

/**
 * Авто, яке я зараз орендую: велике фото з плашками стану й діб, що лишились, назва з роком, прогрес оренди з датами,
 * прибуток за місяць, баланс платежів власнику та швидкі дії (записати заробіток чи витрату, написати власнику).
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
  const balanceLabel = !overview || balance === 0 ? 'Оренда' : balance > 0 ? 'Оренда · борг' : 'Оренда · наперед';
  const balanceText = !overview ? '—' : balance === 0 ? 'Сплачено' : formatMoney(Math.abs(balance));
  const days = stage === 'upcoming' ? daysUntil(deal.startDate) : left;

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button">
          {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
          <View>
            <View>
              <CarPhoto uri={deal.photoUri} style={styles.photo} iconSize={44} />
              <View style={styles.pills}>
                <Pill>
                  <StatusBadge status={stage} dot plain />
                </Pill>
                {days !== undefined && (stage === 'active' || stage === 'upcoming') ? (
                  <Pill>
                    <ThemedText type="smallBold" themeColor="accent">
                      {stage === 'upcoming' ? 'через' : 'ще'} {days} {plural(days, 'доба', 'доби', 'діб')}
                    </ThemedText>
                  </Pill>
                ) : null}
              </View>
            </View>

            <View style={styles.body}>
              <View style={styles.titleRow}>
                <ThemedText type="default" style={[styles.title, styles.flex]} numberOfLines={1}>
                  {name}
                </ThemedText>
                {year ? (
                  <ThemedText type="default" themeColor="textSecondary">
                    {year}
                  </ThemedText>
                ) : null}
              </View>
              {stage === 'active' && overview ? (
                <View style={[styles.track, { backgroundColor: theme.accentSoft }]}>
                  <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(2, Math.round(progress * 100))}%` }]} />
                </View>
              ) : null}
              <ThemedText type="default" themeColor="textSecondary">
                {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </Link>

      <View style={styles.body}>
        {stage === 'signing' ? (
          <>
            <ContractCard deal={deal} as="renter" />
            <ContactChips actions={contactActions({ chat: { dealId: deal.id } })} />
          </>
        ) : (
          <>
            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  За місяць
                </ThemedText>
                <ThemedText style={styles.statValue} themeColor={!month || month.profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(month?.profit ?? 0)}
                </ThemedText>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.backgroundSelected }]}>
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
              <Action icon="chatbubble-ellipses-outline" tone="accent" label="Написати" onPress={() => void openChat({ dealId: deal.id })} />
            </View>
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: Spacing.three, borderRadius: 28, paddingBottom: Spacing.three },
  // Закруглюємо лише верх фото: overflow: hidden на картці прибрав би її тінь
  photo: { width: '100%', aspectRatio: 1.9, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  pills: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill },
  body: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
  flex: { flex: 1 },
  title: { fontWeight: 700, fontSize: 24, lineHeight: 30 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: 2 },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, minHeight: 56, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.two },
  actionIcon: { flex: 0, width: 56, paddingHorizontal: 0 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
