import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { MenuAction } from './more-menu';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Дії зі співрозмовником на картці: «Написати» і «Договір». Кнопки на всю ширину картки й однакові між собою:
 * одна дія займає весь рядок, дві ділять його навпіл. Світла заливка відрізняє їх від головних дій («Прийняти», «Скасувати»).
 */
export function ContactChips({ actions }: { actions: (MenuAction | false | null | undefined)[] }) {
  const theme = useTheme();
  const list = actions.filter((a): a is MenuAction => !!a);
  if (list.length === 0) return null;

  return (
    <View style={styles.row}>
      {list.map((a) => (
        <Pressable
          key={a.title}
          accessibilityRole="button"
          accessibilityLabel={a.title}
          onPress={a.onPress}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accentSoft }, pressed && { opacity: 0.6 }]}>
          <Icon name={a.icon} size={20} color="accent" />
          <ThemedText type="default" themeColor="accent" style={styles.label} numberOfLines={1}>
            {a.short ?? a.title}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, minHeight: 48, borderRadius: Radius.md },
  label: { fontWeight: 700 },
});
