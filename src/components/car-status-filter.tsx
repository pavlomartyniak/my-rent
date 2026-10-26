import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

export type StatusOption = { label: string; count: number };

type Props = {
  options: StatusOption[];
  value: string;
  onChange: (label: string) => void;
  sorts: readonly string[];
  sort: string;
  onSort: (sort: string) => void;
};

/**
 * Одна кнопка «Фільтр» для всього списку авто: у нижньому листі спершу стан авто (з кількістю), нижче сортування.
 * Лист лишається відкритим, поки користувач не натисне «Готово», щоб можна було змінити обидва параметри.
 * Темна кнопка з крапкою означає, що щось відрізняється від типового вигляду.
 */
export function CarStatusFilter({ options, value, onChange, sorts, sort, onSort }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const changed = value !== 'Усі' || sort !== sorts[0];

  const Row = ({ label, selected, right, first, onPress }: { label: string; selected: boolean; right?: string; first?: boolean; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
      <ThemedText type="default" style={styles.title}>
        {label}
      </ThemedText>
      {right !== undefined ? (
        <ThemedText type="default" themeColor="textSecondary">
          {right}
        </ThemedText>
      ) : null}
      {selected ? <Icon name="checkmark" size={22} color="accent" /> : <View style={{ width: 22 }} />}
    </Pressable>
  );

  return (
    <>
      <Chip icon="options-outline" title={value === 'Усі' ? 'Фільтр' : value} active={changed} onPress={() => setOpen(true)} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} onPress={() => {}}>
            <ThemedText type="default" style={styles.heading}>
              Стан авто
            </ThemedText>
            {options.map((o, i) => (
              <Row key={o.label} label={o.label} right={String(o.count)} selected={o.label === value} first={i === 0} onPress={() => onChange(o.label)} />
            ))}

            <ThemedText type="default" style={[styles.heading, styles.second]}>
              Сортування
            </ThemedText>
            {sorts.map((label, i) => (
              <Row key={label} label={label} selected={label === sort} first={i === 0} onPress={() => onSort(label)} />
            ))}

            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={[styles.done, { backgroundColor: theme.ink }]}>
              <ThemedText type="default" style={{ color: theme.onInk, fontWeight: 600 }}>
                Готово
              </ThemedText>
            </Pressable>
          </Pressable>
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
  title: { flex: 1, fontWeight: 500 },
  second: { marginTop: Spacing.three },
  done: { marginTop: Spacing.three, minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
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
