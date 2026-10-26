import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

export type StatusOption = { label: string; count: number };

/** Кнопка-«пігулка» «Фільтр» зі списком станів авто (з кількістю) у нижньому листі */
export function CarStatusFilter({ options, value, onChange }: { options: StatusOption[]; value: string; onChange: (label: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Chip icon="options-outline" title={value === 'Усі' ? 'Фільтр' : value} active={value !== 'Усі'} onPress={() => setOpen(true)} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
            <ThemedText type="default" style={styles.heading}>
              Показати авто
            </ThemedText>
            {options.map((o, i) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                accessibilityState={{ selected: o.label === value }}
                onPress={() => {
                  setOpen(false);
                  onChange(o.label);
                }}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
                <ThemedText type="default" style={styles.title}>
                  {o.label}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                  {o.count}
                </ThemedText>
                {o.label === value ? <Icon name="checkmark" size={22} color="accent" /> : <View style={{ width: 22 }} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  heading: { fontWeight: 700, fontSize: 18, marginBottom: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  title: { flex: 1, fontWeight: 600 },
});

/** Компактна кнопка-«пігулка»: сіра, а коли фільтр увімкнено, графітова */
export function Chip({ title, icon, active, onPress }: { title: string; icon: 'options-outline' | 'swap-vertical'; active?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [chip.base, { backgroundColor: active ? theme.ink : theme.backgroundSelected }, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={16} color={active ? theme.onInk : theme.text} />
      <ThemedText type="smallBold" style={{ color: active ? theme.onInk : theme.text }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const chip = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: Radius.pill },
});
