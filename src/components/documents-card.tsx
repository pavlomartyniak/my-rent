import { useRouter } from 'expo-router';
import { Children, Fragment, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import type { PolicyInfo } from '@/lib/insurance';

import { InsuranceSheet } from './insurance-sheet';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon, type IconName } from './ui/icon';
import { ListRow } from './ui/list-row';

type Tone = 'positive' | 'warning' | 'neutral';

/** Кружечок-іконка рядка документа: колір показує стан (є, чекає дії, немає) */
function Badge({ icon, tone }: { icon: IconName; tone: Tone }) {
  const theme = useTheme();
  const bg = tone === 'positive' ? theme.positiveSoft : tone === 'warning' ? theme.warningSoft : theme.backgroundSelected;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={tone === 'neutral' ? 'textSecondary' : tone} />
    </View>
  );
}

/**
 * «Документи» оренди й авто в одному місці, одразу під карткою оренди: стан авто при передачі (коли оренду вже підписано;
 * до цього він у чек-листі кроків) і страховий поліс. Поліс видно статусом, а керування файлом (завантажити, замінити,
 * видалити) відкривається нижнім листом: так він завжди на виду, але не займає екран.
 */
export function DocumentsCard({ carId, deal, as }: { carId: string; deal?: Pick<DealView, 'id' | 'status' | 'condition' | 'checkin'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data, retry } = useReport<PolicyInfo>(`/insurance/cars/${carId}`, { refetchOnFocus: true, useCache: false, keepPrevious: true });
  if (!data) return null;

  const rows = [];
  if (deal?.condition && deal.status !== 'awaiting') {
    const c = deal.condition;
    rows.push(
      <ListRow
        key="condition"
        title="Стан авто"
        subtitle={c.ready ? 'Зафіксовано при передачі' : 'При передачі не зафіксовано'}
        leading={<Badge icon={c.ready ? 'camera' : 'camera-outline'} tone={c.ready ? 'positive' : 'neutral'} />}
        onPress={() => router.push({ pathname: '/condition/[id]', params: { id: deal.id } })}
      />,
    );
  }

  // Регулярний фотозвіт: власник налаштовує, орендар надсилає; видно лише для оренд, що тривають чи чекають підписання
  if (deal?.checkin && deal.status !== 'terminated') {
    const c = deal.checkin;
    const owner = as === 'owner';
    const tone: Tone = c.state === 'overdue' ? 'warning' : c.state === 'open' ? 'warning' : c.enabled ? 'positive' : 'neutral';
    const subtitle = !c.enabled
      ? owner
        ? 'Не вимагається. Налаштувати регулярний звіт'
        : 'Власник не вимагає'
      : c.state === 'overdue'
        ? `Прострочено на ${c.overdueDays} дн.`
        : c.state === 'open'
          ? owner
            ? 'Чекаємо звіт від орендаря'
            : 'Час надіслати звіт'
          : c.due
            ? `Наступний звіт: ${formatDate(c.due)}`
            : 'Увімкнено';
    rows.push(<ListRow key="checkin" title="Звіти про авто" subtitle={subtitle} leading={<Badge icon={c.enabled ? 'camera' : 'camera-outline'} tone={tone} />} onPress={() => router.push({ pathname: '/checkin/[id]', params: { id: deal.id } })} />);
  }

  const has = data.hasPolicy;
  const canOpen = has || data.canEdit;
  rows.push(
    <ListRow
      key="policy"
      title="Страховий поліс"
      subtitle={has ? `Завантажено · ${data.name}` : data.canEdit ? 'Не додано. Завантажте PDF чи фото' : as === 'renter' ? 'Власник ще не додав' : 'Не додано'}
      leading={<Badge icon={has ? 'shield-checkmark' : 'shield-outline'} tone={has ? 'positive' : data.canEdit ? 'warning' : 'neutral'} />}
      onPress={canOpen ? () => setOpen(true) : undefined}
    />,
  );

  const list = Children.toArray(rows);
  return (
    <Card style={styles.card}>
      <ThemedText type="headline" accessibilityRole="header" style={styles.title}>
        Документи
      </ThemedText>
      {list.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
      <InsuranceSheet carId={carId} data={data} visible={open} onClose={() => setOpen(false)} onChanged={retry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0, paddingVertical: Spacing.three },
  title: { marginBottom: Spacing.one },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(128,128,128,0.25)', marginLeft: 44 + Spacing.three },
});
