import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

type Tone = 'warning' | 'positive' | 'negative' | 'neutral' | 'accent';

/** Статуси запитів на оренду, заявок орендарів і пропозицій власників */
const STATUSES: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Очікує відповіді', tone: 'warning' },
  accepted: { label: 'Прийнято', tone: 'positive' },
  declined: { label: 'Відхилено', tone: 'negative' },
  cancelled: { label: 'Скасовано', tone: 'neutral' },
  withdrawn: { label: 'Відкликано', tone: 'neutral' },
  open: { label: 'Відкрита', tone: 'accent' },
  fulfilled: { label: 'Виконана', tone: 'positive' },
  upcoming: { label: 'Незабаром', tone: 'warning' },
  active: { label: 'Триває', tone: 'positive' },
  finished: { label: 'Завершена', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: string }) {
  const theme = useTheme();
  const { label, tone } = STATUSES[status] ?? { label: status, tone: 'neutral' as Tone };
  const [bg, fg] = {
    warning: [theme.warningSoft, theme.warning],
    positive: [theme.positiveSoft, theme.positive],
    negative: [theme.negativeSoft, theme.negative],
    neutral: [theme.backgroundSelected, theme.textSecondary],
    accent: [theme.accentSoft, theme.accent],
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText type="small" style={[styles.text, { color: fg }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
  text: { fontSize: 12, lineHeight: 18, fontWeight: 700 },
});
