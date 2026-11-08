import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
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
  signing: { label: 'Підписання', tone: 'warning' },
  upcoming: { label: 'Незабаром', tone: 'warning' },
  active: { label: 'Триває', tone: 'positive' },
  finished: { label: 'Завершена', tone: 'neutral' },
  terminated: { label: 'Розірвано', tone: 'negative' },
  closed: { label: 'Закрито', tone: 'neutral' },
  ended: { label: 'Завершено', tone: 'neutral' },
};

export function StatusBadge({ status, dot, plain }: { status: string; /** Крапка кольору статусу перед підписом */ dot?: boolean; /** Без власної заливки: плашка стоїть на білому тлі, наприклад на фото */ plain?: boolean }) {
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
    <View style={[styles.badge, { backgroundColor: plain ? 'transparent' : bg }, plain && styles.plain]}>
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <ThemedText type="small" style={[styles.text, { color: fg }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  plain: { paddingHorizontal: 0, paddingVertical: 0 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, lineHeight: 18, fontWeight: 600 },
});
