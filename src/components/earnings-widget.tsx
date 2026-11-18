import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';

import { DeltaChip } from './delta-chip';
import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';

type Props = {
  /** Підпис періоду: «Цього місяця» */
  title: string;
  profit: number;
  /** Зміна проти минулого періоду, %; без значення пігулки немає */
  change?: number | null;
  /** Розділ «Доходи» своєї ролі: єдине місце, де лежать цифри, графіки й записи */
  href: Href;
};

/**
 * Єдиний вхід у «Доходи» поза самим розділом: одна цифра й стрілка. Жодних графіків чи розбивок,
 * щоб та сама метрика не жила в двох місцях.
 */
export function EarningsWidget({ title, profit, change, href }: Props) {
  const router = useRouter();

  return (
    <Card onPress={() => router.navigate(href)} label={`${title}: прибуток ${formatMoney(profit)}. Відкрити доходи`} style={styles.card}>
      <View style={styles.text}>
        <ThemedText type="callout" themeColor="textSecondary">
          {title}
        </ThemedText>
        <View style={styles.row}>
          <ThemedText type="title" themeColor={profit >= 0 ? 'positive' : 'negative'} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(profit)}
          </ThemedText>
          {change !== undefined ? <DeltaChip change={change} /> : null}
        </View>
      </View>
      <Icon name="chevron-forward" size={20} color="textSecondary" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
