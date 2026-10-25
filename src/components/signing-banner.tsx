import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAwaitingSignature } from '@/hooks/use-pending-requests';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Помітний банер на головній: договір чекає мого підпису. Один договір відкривається одразу, кілька — по черзі. */
export function SigningBanner() {
  const router = useRouter();
  const theme = useTheme();
  const waiting = useAwaitingSignature();
  if (waiting.length === 0) return null;
  const first = waiting[0];

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/contracts/[id]', params: { id: first.id } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={[styles.alert, { backgroundColor: theme.positive }]}>
        <View style={styles.count}>
          <Icon name="create" size={24} color="positive" />
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.title}>
            {waiting.length === 1 ? 'Договір чекає вашого підпису' : `${waiting.length} ${plural(waiting.length, 'договір чекає', 'договори чекають', 'договорів чекають')} вашого підпису`}
          </ThemedText>
          <ThemedText type="small" style={styles.text} numberOfLines={1}>
            {first.title}. Оренда почнеться після підписів обох сторін
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
  flex: { flex: 1 },
  title: { color: '#FFFFFF', fontWeight: 700 },
  text: { color: '#FFFFFF', opacity: 0.95 },
});
