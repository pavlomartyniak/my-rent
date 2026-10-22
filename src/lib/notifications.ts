import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Car, Reminder } from '@/types';

import { fromISODate } from './date';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission() {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function at(iso: string, daysBefore: number, hour: number) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() - daysBefore);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Плануємо два сповіщення: за день і в сам день. Минулі дати пропускаємо. */
export async function scheduleReminder(reminder: Reminder, car?: Car): Promise<string[]> {
  if (!supported || !(await ensureNotificationPermission())) return [];

  const carName = car ? `${car.brand} ${car.model}` : 'Авто';
  const slots = [
    { date: at(reminder.date, 1, 10), body: `Завтра: ${reminder.kind}` },
    { date: at(reminder.date, 0, 9), body: `Сьогодні: ${reminder.kind}` },
  ].filter((s) => s.date.getTime() > Date.now());

  const ids: string[] = [];
  for (const slot of slots) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { title: carName, body: slot.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.date },
      }),
    );
  }
  return ids;
}

export async function cancelNotifications(ids?: string[]) {
  if (!supported || !ids?.length) return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
