import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { openProfile } from '@/lib/profiles';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Друга сторона оренди в картці: аватар, роль, ім'я й підказка «Переглянути профіль» з круглою кнопкою-шевроном. Уся смуга
 * натискається й відкриває профіль (рейтинг, відомості, відгуки), щоб до рішення можна було оцінити людину, а не лише
 * побачити її ім'я.
 */
export function PersonLink({ id, name, photoUri, role }: { id: string; name: string; photoUri?: string | null; role: 'Власник' | 'Орендар' }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${role} ${name}. Переглянути профіль`}
      android_ripple={{ color: theme.border }}
      onPress={() => {
        haptic.select();
        openProfile(id);
      }}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, backgroundColor: pressed && Platform.OS === 'ios' ? theme.backgroundSelected : theme.backgroundElement }]}>
      <View style={[styles.ring, { borderColor: theme.accentSoft }]}>
        <Avatar uri={photoUri ?? null} name={name} size={48} />
      </View>
      <View style={styles.text}>
        <ThemedText type="caption" themeColor="textSecondary">
          {role}
        </ThemedText>
        <ThemedText type="headline" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="caption" themeColor="accent" style={styles.hint}>
          Переглянути профіль
        </ThemedText>
      </View>
      <View style={[styles.go, { backgroundColor: theme.accentSoft }]}>
        <Icon name="chevron-forward" size={18} color="accent" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 72, padding: Spacing.two + 4, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  ring: { borderWidth: 3, borderRadius: 30 },
  text: { flex: 1, gap: 1 },
  hint: { fontWeight: 600 },
  go: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
