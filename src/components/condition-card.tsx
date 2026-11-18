import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DealView } from '@/lib/deals';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Стан авто в оренді: скільки обов'язкових фото вже зроблено при передачі. Тап відкриває екран зі всіма фото обох сторін
 * (і з необов'язковою фіксацією при поверненні). Поки не зафіксовано, оренду не почати, тому картка помітна.
 */
export function ConditionCard({ deal }: { deal: Pick<DealView, 'id' | 'status' | 'condition'> }) {
  const router = useRouter();
  const theme = useTheme();
  const c = deal.condition;
  if (!c) return null;
  const ok = c.ready;
  const pending = deal.status === 'awaiting' && !ok;
  const bg = ok ? theme.positiveSoft : pending ? theme.warningSoft : theme.backgroundSelected;
  const tone = ok ? 'positive' : pending ? 'warning' : 'textSecondary';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Стан авто" onPress={() => router.push({ pathname: '/condition/[id]', params: { id: deal.id } })}>
      <View style={[styles.panel, { backgroundColor: bg }]}>
        <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
          <Icon name={ok ? 'camera' : 'camera-outline'} size={20} color={tone} />
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold" themeColor={tone}>
            {ok ? 'Стан авто зафіксовано' : pending ? 'Зафіксуйте стан авто' : 'Стан авто не зафіксовано'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {ok ? 'Фото кузова й салону при передачі · Переглянути' : `Обов’язкові фото: ${c.have} з ${c.need}${pending ? '. Без цього оренду не почати' : ''}`}
          </ThemedText>
        </View>
        <Icon name="chevron-forward" size={18} color="textSecondary" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  iconBox: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
