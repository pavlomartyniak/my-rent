import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { monthTitle, shiftMonth, todayISO } from '@/lib/date';

import { ThemedText } from './themed-text';
import { IconButton } from './ui/icon-button';
import { Segmented } from './ui/segmented';

const PERIODS = ['Місяць', 'Рік'] as const;
type Period = (typeof PERIODS)[number];

/** Стан вибору періоду для звітів: місяць або рік, з гортанням у минуле */
export function usePeriod() {
  const current = todayISO().slice(0, 7);
  const [period, setPeriod] = useState<Period>('Місяць');
  const [month, setMonth] = useState(current);

  const yearly = period === 'Рік';
  const key = yearly ? month.slice(0, 4) : month;
  const step = yearly ? 12 : 1;

  return {
    period,
    setPeriod,
    /** 'YYYY-MM' або 'YYYY' — для filterByPeriod */
    key,
    label: yearly ? key : monthTitle(month),
    /** Місяці для графіка: 12 місяців року або останні 6 до вибраного */
    months: yearly
      ? Array.from({ length: 12 }, (_, i) => `${key}-${String(i + 1).padStart(2, '0')}`)
      : [5, 4, 3, 2, 1, 0].map((n) => shiftMonth(month, -n)),
    atEnd: yearly ? key >= current.slice(0, 4) : month >= current,
    prev: () => setMonth(shiftMonth(month, -step)),
    next: () => setMonth(shiftMonth(month, step)),
  };
}

export function PeriodSwitcher({ state }: { state: ReturnType<typeof usePeriod> }) {
  return (
    <View style={styles.wrap}>
      <Segmented options={PERIODS} value={state.period} onChange={state.setPeriod} />
      <View style={styles.stepper}>
        <IconButton icon="chevron-back" label="Назад" onPress={state.prev} />
        <ThemedText type="default" style={styles.label}>
          {state.label}
        </ThemedText>
        <IconButton icon="chevron-forward" label="Вперед" disabled={state.atEnd} onPress={state.next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontWeight: 700 },
});
