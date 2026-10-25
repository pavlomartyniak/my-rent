import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney, plural } from '@/lib/format';
import { wantedTitle, type WantedView } from '@/lib/wanted';

import { StatusBadge } from './status-badge';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

type Props = {
  wanted: WantedView;
  viewer: 'renter' | 'owner';
  /** Кнопки дій */
  children?: ReactNode;
};

/** Заявка орендаря: яке авто, де, на які дати й за який бюджет */
export function WantedCard({ wanted: w, viewer, children }: Props) {
  const offers = w.offers;
  const theme = useTheme();
  // Є пропозиції, на які орендар ще не відповів: картка виділяється, щоб їх не пропустити
  const fresh = viewer === 'renter' && w.status === 'open' && (offers?.pending ?? 0) > 0;

  return (
    <Card style={fresh ? { borderColor: theme.accent, borderWidth: 2 } : undefined}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.bold}>
            {wantedTitle(w)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {w.city}
          </ThemedText>
        </View>
        {viewer === 'renter' ? <StatusBadge status={w.status === 'fulfilled' && (w.dealStage === 'terminated' || w.dealStage === 'finished') ? w.dealStage : w.status} /> : null}
      </View>

      <View style={styles.rows}>
        <Row label="Дати" value={`${formatDate(w.startDate)} – ${formatDate(w.endDate)} · ${w.days} ${plural(w.days, 'доба', 'доби', 'діб')}`} />
        <Row label="Бюджет" value={w.maxPricePerDay ? `до ${formatMoney(w.maxPricePerDay)} за добу` : 'не вказано'} />
        {viewer === 'owner' && w.renter ? <Row label="Орендар" value={w.renter} /> : null}
      </View>

      {w.notes ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.notes}>
          «{w.notes}»
        </ThemedText>
      ) : null}

      {viewer === 'owner' && w.matches ? (
        w.matches.length > 0 ? (
          <ThemedText type="smallBold" themeColor="positive">
            ✓ Підходить: {w.matches.map((m) => m.title).join(', ')}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            У вас немає вільного авто під цю заявку
          </ThemedText>
        )
      ) : null}

      {viewer === 'renter' && w.status === 'fulfilled' && w.dealStage === 'signing' ? (
        <ThemedText type="smallBold" themeColor="accent">
          Наступний крок: договір. Перегляньте його, а підпишіть під час зустрічі з власником
        </ThemedText>
      ) : null}

      {fresh ? (
        <View style={[styles.fresh, { backgroundColor: theme.accent }]}>
          <Icon name="notifications" size={18} color="#FFFFFF" />
          <ThemedText type="smallBold" style={styles.freshText}>
            {offers!.pending} {plural(offers!.pending, 'нова пропозиція', 'нові пропозиції', 'нових пропозицій')} від власників
          </ThemedText>
          <Icon name="chevron-forward" size={18} color="#FFFFFF" />
        </View>
      ) : viewer === 'renter' && offers ? (
        <View style={styles.offers}>
          <Icon name="albums-outline" size={16} color={offers.pending > 0 ? 'accent' : 'textSecondary'} />
          <ThemedText type="smallBold" themeColor={offers.pending > 0 ? 'accent' : 'textSecondary'}>
            {offers.total === 0 ? 'Пропозицій ще немає' : `Пропозицій: ${offers.total}${offers.pending > 0 ? ` · нових: ${offers.pending}` : ''}`}
          </ThemedText>
        </View>
      ) : null}

      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  rows: { gap: Spacing.one, marginTop: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { flexShrink: 1, fontWeight: 600, textAlign: 'right' },
  notes: { fontStyle: 'italic' },
  offers: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  fresh: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  freshText: { flex: 1, color: '#FFFFFF' },
});
