import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { carFacts } from '@/lib/car-info';
import { contactActions } from '@/lib/contact-actions';
import { daysUntil, formatDate, rentalProgress } from '@/lib/date';
import { dealStage, type DealView } from '@/lib/deals';
import { formatMoney, plural, splitTitle } from '@/lib/format';

import { CarPhoto } from './car-photo';
import { ColorDot } from './color-dot';
import { ContactChips } from './contact-chips';
import { ContractCard } from './contract-card';
import { PersonLink } from './person-link';
import { PlateBadge } from './plate-badge';
import { FactTiles } from './request-facts';
import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';

/**
 * Авто, яке я орендую, у списку. Зверху фото зі станом оренди, під ним назва, номер і колір; далі власник (натискається,
 * відкриває профіль), ключові умови плитками (дати, ціна за добу, скільки лишилось) і смуга прогресу. Тап по фото й назві
 * відкриває оренду з платежами й договором. Поки договір не підписано, внизу стоїть чек-лист кроків і швидкий чат.
 */
export function ActiveDealCard({ deal }: { deal: DealView }) {
  const theme = useTheme();
  const stage = dealStage(deal);
  const { name, year } = splitTitle(deal.title);
  const running = stage === 'active';
  const left = running ? Math.max(0, daysUntil(deal.endDate)) : stage === 'upcoming' ? Math.max(0, daysUntil(deal.startDate)) : null;
  const progress = running ? rentalProgress(deal.startDate, deal.endDate) : 0;
  const facts = deal.car ? carFacts({ fuel: deal.car.fuel, mileage: deal.car.mileage }) : '';

  const tiles = [
    { icon: 'calendar-outline' as const, label: 'Дати оренди', value: `${formatDate(deal.startDate)} – ${formatDate(deal.endDate)}`, wide: true },
    { icon: 'cash-outline' as const, label: 'Ціна за добу', value: formatMoney(deal.pricePerDay) },
    ...(left !== null ? [{ icon: 'time-outline' as const, label: running ? 'Залишилось' : 'Початок через', value: `${left} ${plural(left, 'доба', 'доби', 'діб')}` }] : []),
  ];

  return (
    <Card style={styles.card}>
      <Link href={{ pathname: '/deals/[id]', params: { id: deal.id } }} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={`${deal.title}. Відкрити оренду`}>
          {/* Розкладка — на внутрішньому View: стиль-функція Pressable під Link asChild не застосовується */}
          <View>
            <View>
              <CarPhoto uri={deal.photoUri} style={styles.photo} iconSize={40} />
              <View style={styles.status}>
                <StatusBadge status={stage} />
              </View>
            </View>
            <View style={styles.head}>
              <ThemedText type="headline" numberOfLines={2}>
                {[name, year].filter(Boolean).join(' · ')}
              </ThemedText>
              {deal.car?.plate || deal.car?.color ? (
                <View style={styles.plate}>
                  {deal.car?.plate ? <PlateBadge plate={deal.car.plate} small /> : null}
                  <ColorDot color={deal.car?.color} />
                </View>
              ) : null}
              {facts ? (
                <ThemedText type="callout" themeColor="textSecondary" numberOfLines={1}>
                  {facts}
                </ThemedText>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Link>

      <View style={styles.body}>
        <PersonLink id={deal.counterpart.id} name={deal.counterpart.name} photoUri={deal.counterpart.photoUri} role="Власник" />

        <FactTiles items={tiles} />

        {running ? (
          <View style={[styles.track, { backgroundColor: theme.accentSoft }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(3, Math.round(progress * 100))}%` }]} />
          </View>
        ) : null}

        {stage === 'signing' ? (
          <>
            <ContractCard deal={deal} as="renter" />
            <ContactChips actions={contactActions({ chat: { dealId: deal.id } })} />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0 },
  photo: { width: '100%', height: 156, borderRadius: 0 },
  status: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  head: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.two },
  plate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  body: { padding: Spacing.three, gap: Spacing.three },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
