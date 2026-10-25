import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAwaitingSignature } from '@/hooks/use-pending-requests';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { plural } from '@/lib/format';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Банер на головній про договір. Пора підписувати (вікно відкрите) — зелений: «Час підписати договір».
 * Договір лише сформовано — синій: можна прочитати зараз, а підписувати при зустрічі.
 */
export function SigningBanner() {
  const router = useRouter();
  const theme = useTheme();
  const waiting = useAwaitingSignature();
  if (waiting.length === 0) return null;

  const now = waiting.filter((d) => d.contract?.signing.state === 'open');
  const ready = now.length > 0;
  const list = ready ? now : waiting;
  const first = list[0];
  const color = ready ? theme.positive : theme.accent;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/contracts/[id]', params: { id: first.id } })} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <View style={[styles.alert, { backgroundColor: color }]}>
        <View style={styles.count}>
          <Icon name={ready ? 'create' : 'document-text'} size={24} color={ready ? 'positive' : 'accent'} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="default" style={styles.title}>
            {ready
              ? list.length === 1
                ? 'Час підписати договір'
                : `${list.length} ${plural(list.length, 'договір', 'договори', 'договорів')} пора підписати`
              : list.length === 1
                ? 'Договір сформовано'
                : `${list.length} ${plural(list.length, 'договір', 'договори', 'договорів')} сформовано`}
          </ThemedText>
          <ThemedText type="small" style={styles.text} numberOfLines={2}>
            {ready
              ? `${first.title}. Підписуйте під час зустрічі, коли передаєте авто, ключі й гроші`
              : `${first.title}. Перегляньте договір зараз, а підписуйте при зустрічі${first.contract ? ` (з ${formatDate(first.contract.signing.opensAt)})` : ''}`}
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
