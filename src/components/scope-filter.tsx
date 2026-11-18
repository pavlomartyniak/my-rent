import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MinHit, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { ThemedText } from './themed-text';
import { BottomSheet } from './ui/bottom-sheet';
import { Icon } from './ui/icon';

type Option = { id: string; label: string };

/**
 * Випадний список розділу «Доходи»: «Усі» або одне авто / одна оренда. Не гортається вбік: поле показує
 * вибране, тап відкриває список у нижньому листі. Цифри, графік і записи лишаються в одному місці,
 * змінюється лише вибірка.
 */
export function ScopeFilter({ label, allLabel, options, value, onChange }: { label: string; allLabel: string; options: Option[]; value: string | null; onChange: (id: string | null) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const items: { id: string | null; label: string }[] = [{ id: null, label: allLabel }, ...options];
  const current = items.find((i) => i.id === value) ?? items[0];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current.label}. Змінити`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong }, pressed && { opacity: 0.7 }]}>
        <View style={styles.text}>
          <ThemedText type="caption" themeColor="textSecondary">
            {label}
          </ThemedText>
          <ThemedText type="headline" numberOfLines={1}>
            {current.label}
          </ThemedText>
        </View>
        <Icon name="chevron-down" size={20} color="textSecondary" />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <ThemedText type="title" accessibilityRole="header">
          {label}
        </ThemedText>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((item, i) => {
            const selected = item.id === value;
            return (
              <Pressable
                key={item.id ?? 'all'}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                onPress={() => {
                  haptic.select();
                  onChange(item.id);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
                <ThemedText type="body" style={[styles.rowText, selected && { fontWeight: 700 }]} numberOfLines={2}>
                  {item.label}
                </ThemedText>
                <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? 'accent' : 'textSecondary'} />
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 60, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flex: 1 },
  list: { maxHeight: 380 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: Math.max(52, MinHit) },
  rowText: { flex: 1 },
});
