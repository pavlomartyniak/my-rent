import { useState } from 'react';
import { Alert, Animated, Easing, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { daysUntil, formatDate } from '@/lib/date';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { useFleet } from '@/store/fleet';
import { type Reminder, reminderTitle } from '@/types';

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

/**
 * Кружечок зліва — позначити виконаним, кошик справа — видалити. Позначене виконаним спершу показує галочку, потім картка стискається й
 * «летить» угору до вкладки «Архів» (а з архіву так само до «Активних»); `onToggled` повідомляє екран, щоб той показав статус.
 */
export function ReminderRow({ reminder, onToggled }: { reminder: Reminder; onToggled?: (reminder: Reminder, done: boolean) => void }) {
  const { cars, toggleReminder, deleteReminder } = useFleet();
  const car = cars.find((c) => c.id === reminder.carId);
  const theme = useTheme();
  const days = daysUntil(reminder.date);
  const urgent = !reminder.done && days < 0;

  function confirmDelete() {
    Alert.alert('Видалити нагадування?', undefined, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => void deleteReminder(reminder.id) },
    ]);
  }

  // Хід «польоту» в архів: 0 — на місці, 1 — зникла
  const [fly] = useState(() => new Animated.Value(0));
  const [flying, setFlying] = useState(false);
  // Під час польоту галочка вже показує новий стан: виконане стає активним (порожній кружечок) і навпаки
  const checked = reminder.done !== flying;

  function toggle() {
    if (flying) return;
    haptic.success();
    setFlying(true);
    // Коротка пауза, щоб побачити галочку, потім картка стискається й летить до вкладки
    Animated.sequence([Animated.delay(260), Animated.timing(fly, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true })]).start(({ finished }) => {
      if (!finished) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      void toggleReminder(reminder.id).then((ok) => {
        if (ok) return onToggled?.(reminder, !reminder.done);
        // Не вдалося зберегти: картка повертається
        setFlying(false);
        fly.setValue(0);
      });
    });
  }

  const soon = days <= 7;
  return (
    <Animated.View
      style={{
        opacity: fly.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
        transform: [
          { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -90] }) },
          { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) },
        ],
        transformOrigin: 'left top',
      }}>
    <Card style={[styles.row, reminder.done && styles.done]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Виконано"
        accessibilityState={{ checked: reminder.done }}
        hitSlop={10}
        onPress={toggle}
        style={styles.check}>
        <Icon name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={30} color={checked ? 'positive' : 'accent'} />
      </Pressable>

      <View style={styles.body}>
        <View style={styles.head}>
          <ThemedText type="default" style={[styles.title, reminder.done ? styles.strike : styles.bold]} numberOfLines={2}>
            {reminderTitle(reminder)}
          </ThemedText>
          <IconButton icon="trash-outline" label="Видалити" tone="neutral" size={32} onPress={confirmDelete} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {car ? `${car.brand} ${car.model}` : 'Авто видалено'}
        </ThemedText>
        <View style={styles.meta}>
          {reminder.done ? null : (
            // Скільки лишилось: червоне — прострочено, жовте — найближчі дні, нейтральне — ще далеко
            <View style={[styles.chip, { backgroundColor: urgent ? theme.negativeSoft : soon ? theme.warningSoft : theme.backgroundSelected }]}>
              <ThemedText type="smallBold" themeColor={urgent ? 'negative' : soon ? 'warning' : 'textSecondary'}>
                {dueLabel(days)}
              </ThemedText>
            </View>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(reminder.date)}
          </ThemedText>
        </View>
      </View>
    </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  check: { paddingTop: 2 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  title: { flex: 1, minWidth: 0, paddingTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.one },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 4, borderRadius: Radius.pill },
  done: { opacity: 0.55 },
  strike: { textDecorationLine: 'line-through' },
  bold: { fontWeight: 600 },
});
