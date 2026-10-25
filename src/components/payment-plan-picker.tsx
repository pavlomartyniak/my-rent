import { View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { Segmented } from './ui/segmented';

export const MONTHLY_MIN_DAYS = 60;
export type PaymentPlan = 'lump' | 'monthly';
const LABELS = { lump: 'Одразу вся сума', monthly: 'Щомісяця' } as const;
const OPTIONS = [LABELS.lump, LABELS.monthly] as const;

/**
 * Вибір плану оплати в запиті чи пропозиції. Частинами можна платити лише за оренду від 60 діб, для коротшої
 * вибору немає: оплачується вся сума одразу, це одразу видно під блоком.
 */
export function PaymentPlanPicker({ days, value, onChange }: { days: number; value: PaymentPlan; onChange: (plan: PaymentPlan) => void }) {
  const allowed = days >= MONTHLY_MIN_DAYS;
  const plan: PaymentPlan = allowed ? value : 'lump';

  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="small" themeColor="textSecondary">
        Оплата
      </ThemedText>
      {allowed ? (
        <Segmented options={OPTIONS} value={LABELS[plan]} onChange={(label) => onChange(label === LABELS.monthly ? 'monthly' : 'lump')} />
      ) : (
        <ThemedText type="default" style={{ fontWeight: 600 }}>
          {LABELS.lump}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {allowed
          ? plan === 'monthly'
            ? 'Орендар платить за кожні 30 діб: перший платіж під час передачі авто. Графік потрапить у договір.'
            : 'Орендар сплачує всю суму під час передачі авто.'
          : `Частинами можна платити за оренду від ${MONTHLY_MIN_DAYS} діб. Коротша оплачується одразу вся.`}
      </ThemedText>
    </View>
  );
}
