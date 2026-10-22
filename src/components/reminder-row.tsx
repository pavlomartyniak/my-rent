import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { daysUntil, formatDate } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import type { Reminder } from '@/types';

import { ThemedText } from './themed-text';
import { Card } from './ui/card';
import { Icon } from './ui/icon';
import { IconButton } from './ui/icon-button';

export function dueLabel(days: number) {
  if (days < 0) return `Прострочено на ${-days} дн.`;
  if (days === 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}

/** Кружечок зліва — позначити виконаним, кошик справа — видалити */
export function ReminderRow({ reminder }: { reminder: Reminder }) {
  const { cars, toggleReminder, deleteReminder } = useFleet();
  const car = cars.find((c) => c.id === reminder.carId);
  const days = daysUntil(reminder.date);
  const urgent = !reminder.done && days < 0;

  function confirmDelete() {
    Alert.alert('Видалити нагадування?', undefined, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => void deleteReminder(reminder.id) },
    ]);
  }

  return (
    <Card style={[styles.row, reminder.done && styles.done]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Виконано"
        accessibilityState={{ checked: reminder.done }}
        hitSlop={10}
        onPress={() => void toggleReminder(reminder.id)}>
        <Icon name={reminder.done ? 'checkmark-circle' : 'ellipse-outline'} size={30} color={reminder.done ? 'positive' : 'accent'} />
      </Pressable>
      <View style={styles.flex}>
        <ThemedText type="default" style={reminder.done ? styles.strike : styles.bold}>
          {reminder.kind} · {car ? `${car.brand} ${car.model}` : 'Авто видалено'}
        </ThemedText>
        <ThemedText type="small" themeColor={urgent ? 'negative' : 'textSecondary'}>
          {reminder.done ? formatDate(reminder.date) : `${dueLabel(days)} · ${formatDate(reminder.date)}`}
        </ThemedText>
      </View>
      <IconButton icon="trash-outline" label="Видалити" tone="neutral" size={38} onPress={confirmDelete} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  done: { opacity: 0.55 },
  strike: { textDecorationLine: 'line-through' },
  bold: { fontWeight: 600 },
});
