import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STATUS_LABEL, type RentalStatus } from '@/lib/rentals';

import { ThemedText } from './themed-text';

export function StatusBadge({ status }: { status: RentalStatus }) {
  const theme = useTheme();
  const look = {
    pending: [theme.warningSoft, theme.warning],
    accepted: [theme.positiveSoft, theme.positive],
    declined: [theme.negativeSoft, theme.negative],
    cancelled: [theme.backgroundSelected, theme.textSecondary],
  }[status];

  return (
    <View style={[styles.badge, { backgroundColor: look[0] }]}>
      <ThemedText type="small" style={[styles.text, { color: look[1] }]}>
        {STATUS_LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Radius.pill },
  text: { fontSize: 12, lineHeight: 18, fontWeight: 700 },
});
