import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, fromISODate, toISODate } from '@/lib/date';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Props = { label: string; value: string; onChange: (iso: string) => void; minimumDate?: Date };

/**
 * Поле дати у тому ж стилі, що й решта полів. На iOS календар розкривається під полем
 * і згортається після вибору дня, на Android відкривається системний діалог.
 */
export function DateField({ label, value, onChange, minimumDate }: Props) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [open, setOpen] = useState(false);
  const date = fromISODate(value);

  function onPress() {
    if (Platform.OS === 'ios') {
      setOpen((o) => !o);
      return;
    }
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      minimumDate,
      onChange: (_, picked) => picked && onChange(toISODate(picked)),
    });
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: theme.backgroundElement, borderColor: open ? theme.accent : theme.borderStrong },
          pressed && styles.pressed,
        ]}>
        <Icon name="calendar-outline" size={20} color="accent" />
        <ThemedText type="default" style={styles.text}>
          {formatDate(value)}
        </ThemedText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="accent" />
      </Pressable>

      {open && Platform.OS === 'ios' ? (
        <View style={[styles.calendar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            locale="uk-UA"
            themeVariant={scheme}
            accentColor={theme.accent}
            minimumDate={minimumDate}
            style={styles.picker}
            onChange={(_, picked) => {
              if (!picked) return;
              onChange(toISODate(picked));
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  box: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: { flex: 1, fontWeight: 600 },
  pressed: { opacity: 0.7 },
  calendar: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.two, overflow: 'hidden' },
  picker: { alignSelf: 'stretch' },
});
