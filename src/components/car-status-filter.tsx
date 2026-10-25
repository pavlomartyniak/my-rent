import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

export type StatusOption = { label: string; count: number };

/** Кнопка «Фільтрувати за…» зі списком станів авто (з кількістю) у нижньому листі */
export function CarStatusFilter({ options, value, onChange }: { options: StatusOption[]; value: string; onChange: (label: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button title={value === 'Усі' ? 'Фільтрувати за станом' : `Стан: ${value}`} icon="filter" variant="secondary" onPress={() => setOpen(true)} />

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
