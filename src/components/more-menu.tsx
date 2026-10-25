import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon, type IconName } from './ui/icon';

export type MenuAction = { title: string; /** Короткий підпис для компактних кнопок */ short?: string; icon: IconName; onPress: () => void; destructive?: boolean };

/**
 * Кнопка «···» з меню другорядних дій (написати, зателефонувати, переглянути договір…). Так на картці лишається
 * одна головна кнопка, а решта не заважає, але завжди під рукою. Без дій кнопка не показується.
 */
export function MoreMenu({ actions, label = 'Ще дії' }: { actions: (MenuAction | false | null | undefined)[]; label?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const list = actions.filter((a): a is MenuAction => !!a);
  if (list.length === 0) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundSelected }, pressed && { opacity: 0.6 }]}>
        <Icon name="ellipsis-horizontal" size={20} color="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
            {list.map((a, i) => (
              <Pressable
                key={a.title}
                accessibilityRole="button"
                onPress={() => {
                  setOpen(false);
                  a.onPress();
                }}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
                <Icon name={a.icon} size={22} color={a.destructive ? 'negative' : 'accent'} />
                <ThemedText type="default" themeColor={a.destructive ? 'negative' : 'text'} style={styles.title}>
                  {a.title}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={[styles.cancel, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="default" style={styles.title}>
                Закрити
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  title: { fontWeight: 600 },
  cancel: { marginTop: Spacing.two, paddingVertical: Spacing.three, borderRadius: Radius.md, alignItems: 'center' },
});
