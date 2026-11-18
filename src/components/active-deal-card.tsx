import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { carFacts } from '@/lib/car-info';
import { contactActions } from '@/lib/contact-actions';
import { daysUntil, formatDate, rentalProgress } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney, plural, splitTitle } from '@/lib/format';

import { Avatar } from './avatar';
import { CarPhoto } from './car-photo';
import { ColorDot } from './color-dot';
import { ContactChips } from './contact-chips';
import { ContractCard } from './contract-card';
import { PlateBadge } from './plate-badge';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

/**
 * Авто, яке я орендую, у списку: фото зі станом, назва з роком, власник з аватаром, державний номер, колір і паливо, а нижче
 * панель оренди: скільки лишилось діб з прогресом і датами та ціна за добу. Тап відкриває оренду з платежами, історією й записами.
 * Поки договір не підписано (чи не підтверджено умови), під карткою стоїть картка підписання й швидкий чат.
 */
export function ActiveDealCard({ deal }: { deal: DealView }) {
  const theme = useTheme();
  const stage = dealStage(deal);
  const { name, year } = splitTitle(deal.title);
  const running = stage === 'active';
  const left = running ? Math.max(0, daysUntil(deal.endDate)) : stage === 'upcoming' ? Math.max(0, daysUntil(deal.startDate)) : null;
  const progress = running ? rentalProgress(deal.startDate, deal.endDate) : 0;
  const facts = deal.car ? carFacts({ fuel: deal.car.fuel, mileage: deal.car.mileage }) : '';

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={`${deal.title}. Відкрити оренду`}>
          {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
          <View style={styles.content}>
            <View style={styles.top}>
              <View>
                <CarPhoto uri={deal.photoUri} style={styles.photo} iconSize={34} />
                {/* Стан оренди лежить на фото, щоб назва мала всю ширину */}
                <View style={styles.badge}>
                  <StatusBadge status={stage} />
                </View>
              </View>
              <View style={styles.info}>
                <ThemedText type="default" style={styles.name} numberOfLines={1}>
                  {name}
                </ThemedText>
                <View style={styles.owner}>
                  <Avatar uri={deal.counterpart.photoUri} name={deal.counterpart.name} size={20} />
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
                    {[year, deal.counterpart.name].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {deal.car?.plate || deal.car?.color ? (
                  <View style={styles.facts}>
                    {deal.car?.plate ? <PlateBadge plate={deal.car.plate} small /> : null}
                    <ColorDot color={deal.car?.color} />
                  </View>
                ) : null}
                {facts ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {facts}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            {/* Панель оренди: строк і прогрес ліворуч, ціна праворуч */}
            <View style={[styles.panel, { backgroundColor: theme.backgroundSelected }]}>
              <View style={styles.flex}>
                <View style={styles.dates}>
                  <Icon name="calendar-outline" size={14} color="textSecondary" />
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {formatDate(deal.startDate)} – {formatDate(deal.endDate)}
                  </ThemedText>
                </View>
                {left !== null ? (
                  <ThemedText type="smallBold" themeColor="accent">
                    {running ? 'Ще' : 'Через'} {left} {plural(left, 'доба', 'доби', 'діб')}
                  </ThemedText>
                ) : null}
                {running ? (
                  <View style={[styles.track, { backgroundColor: theme.accentSoft }]}>
                    <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(3, Math.round(progress * 100))}%` }]} />
                  </View>
                ) : null}
              </View>
              <View style={[styles.price, { backgroundColor: theme.positiveSoft }]}>
                <ThemedText style={styles.priceValue} themeColor="positive" numberOfLines={1}>
                  {formatMoney(deal.pricePerDay)}
                </ThemedText>
                <ThemedText type="small" themeColor="positive">
                  за добу
                </ThemedText>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>

      {stage === 'signing' ? (
        <>
          <ContractCard deal={deal} as="renter" />
          <ContactChips actions={contactActions({ chat: { dealId: deal.id } })} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.three, borderRadius: 24 },
  content: { gap: Spacing.three },
  top: { flexDirection: 'row', gap: Spacing.three },
  photo: { width: 104, height: 104, borderRadius: 18 },
  badge: { position: 'absolute', left: 6, bottom: 6 },
  info: { flex: 1, gap: 6, justifyContent: 'center' },
  flex: { flex: 1 },
  name: { ...Type.headline },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  dates: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
  price: { alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Radius.md },
  priceValue: { ...Type.headline },
});
