import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { MenuAction } from './more-menu';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Дії зі співрозмовником прямо на картці: «Написати», «Зателефонувати», «Договір». Компактні кнопки в один ряд,
 * щоб усе було видно одразу, але картка не розросталась.
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
          style={({ pressed }) => [styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }, pressed && { opacity: 0.6 }]}>
          <Icon name={a.icon} size={18} color="accent" />
          <ThemedText type="smallBold" themeColor="accent" numberOfLines={1}>
            {a.short ?? a.title}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1.5 },
});
