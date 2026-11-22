import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, fromISODate, toISODate } from '@/lib/date';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Props = { label: string; value: string; onChange: (iso: string) => void; minimumDate?: Date; maximumDate?: Date; /** Порожнє значення: підпис замість дати й дата, з якої відкривається календар */ placeholder?: string; initialDate?: Date; /** Колесо вибору (день, місяць, рік) замість календаря: швидше для дат народження й документів */ wheel?: boolean; /** Помилка поля: червона рамка й текст під ним */ error?: string };

/**
 * Поле дати у тому ж стилі, що й решта полів. На iOS календар розкривається під полем
 * і згортається кнопкою «Готово», на Android відкривається системний діалог.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder, initialDate, wheel, error }: Props) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [open, setOpen] = useState(false);
  const date = value ? fromISODate(value) : (initialDate ?? new Date());
  const shown = value ? formatDate(value) : (placeholder ?? 'Оберіть дату');

  function onPress() {
    if (Platform.OS === 'ios') {
      // Порожнє поле з колесом: одразу показуємо стартову дату, щоб «Готово» без прокрутки теж щось зберегло
      if (!open && !value && wheel) onChange(toISODate(date));
      setOpen((o) => !o);
      return;
    }
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      minimumDate,
      maximumDate,
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
        accessibilityLabel={`${label}: ${shown}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: theme.backgroundElement, borderColor: error ? theme.negative : open ? theme.accent : theme.borderStrong },
          pressed && styles.pressed,
        ]}>
        <Icon name="calendar-outline" size={20} color="accent" />
        <ThemedText type="default" themeColor={value ? 'text' : 'textSecondary'} style={styles.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {shown}
        </ThemedText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="accent" />
      </Pressable>
      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <View style={[styles.calendar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <DateTimePicker
            value={date}
            mode="date"
            display={wheel ? 'spinner' : 'inline'}
            locale="uk-UA"
            themeVariant={scheme}
            accentColor={theme.accent}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={styles.picker}
            // Вибір дня, місяця чи року не закриває календар: закриває лише «Готово»
            onChange={(_, picked) => picked && onChange(toISODate(picked))}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Готово" onPress={() => setOpen(false)} style={({ pressed }) => [styles.done, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Готово
            </ThemedText>
          </Pressable>
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
  done: { minHeight: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
});
