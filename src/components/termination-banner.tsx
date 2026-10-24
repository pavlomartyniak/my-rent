import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTerminationRequests } from '@/hooks/use-pending-requests';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Помітний банер на головній: друга сторона пропонує розірвати оренду й чекає відповіді */
export function TerminationBanner({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const count = useTerminationRequests().length;
  if (count === 0) return null;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={[styles.alert, { backgroundColor: theme.warning }]}>
        <View style={styles.count}>
          <ThemedText style={[styles.countText, { color: theme.warning }]}>{count}</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.title}>
            {count} {plural(count, 'пропозиція', 'пропозиції', 'пропозицій')} розірвати оренду
          </ThemedText>
          <ThemedText type="small" style={styles.text}>
            Друга сторона чекає вашої відповіді. Натисніть, щоб відповісти
          </ThemedText>
        </View>
        <Icon name="chevron-forward" size={20} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  count: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 20, lineHeight: 24, fontWeight: 800 },
  flex: { flex: 1 },
  title: { color: '#FFFFFF', fontWeight: 700 },
  text: { color: '#FFFFFF', opacity: 0.95 },
});
