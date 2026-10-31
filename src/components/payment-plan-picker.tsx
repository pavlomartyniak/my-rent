import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { availablePlans, effectivePlan, type ChoosablePlan } from '@/lib/payment-plan';

import { ThemedText } from './themed-text';
import { Segmented } from './ui/segmented';

const LABELS: Record<ChoosablePlan, string> = { lump: 'Одразу вся сума', weekly: 'Щотижня', daily: 'Щодня' };
const HINTS: Record<ChoosablePlan, string> = {
  lump: 'Орендар сплачує всю суму під час передачі авто.',
  weekly: 'Орендар платить за кожні 7 діб наперед: перший платіж під час передачі авто. Збігається з тижневими виплатами Bolt, Uber чи Uklon. Графік потрапить у договір.',
  daily: 'Орендар платить за кожну добу наперед: перший платіж під час передачі авто. Графік потрапить у договір.',
};

/**
 * Вибір плану оплати в запиті чи пропозиції. Щотижня можна платити за оренду довшу за 7 діб, щодня — від 2 діб.
 * Для однієї доби вибору немає: оплачується вся сума одразу, це видно під блоком.
 */
export function PaymentPlanPicker({ days, value, onChange }: { days: number; value: ChoosablePlan; onChange: (plan: ChoosablePlan) => void }) {
  const options = availablePlans(days);
  const plan = effectivePlan(days, value);

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="small" themeColor="textSecondary">
        Оплата
      </ThemedText>
      {options.length > 1 ? (
        <Segmented options={options.map((o) => LABELS[o])} value={LABELS[plan]} onChange={(label) => onChange(options.find((o) => LABELS[o] === label) ?? 'lump')} />
      ) : (
        <ThemedText type="default" style={{ fontWeight: 600 }}>
          {LABELS.lump}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {options.length > 1 ? HINTS[plan] : 'Оренда на одну добу оплачується одразу вся.'}
      </ThemedText>
    </View>
  );
}
