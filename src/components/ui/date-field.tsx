import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { formatDate, fromISODate, toISODate } from '@/lib/date';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Props = { label: string; value: string; onChange: (iso: string) => void; minimumDate?: Date };

export function DateField({ label, value, onChange, minimumDate }: Props) {
  const theme = useTheme();
  const date = fromISODate(value);

  function openAndroid() {
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
      <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            locale="uk-UA"
            minimumDate={minimumDate}
            onChange={(_, picked) => picked && onChange(toISODate(picked))}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={openAndroid} style={styles.androidRow}>
            <Icon name="calendar-outline" size={18} color="textSecondary" />
            <ThemedText>{formatDate(value)}</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  box: {
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  androidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.one, minHeight: 48 },
});
