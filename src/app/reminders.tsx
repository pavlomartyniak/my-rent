import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ReminderRow } from '@/components/reminder-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { daysUntil } from '@/lib/date';
import { useFleet } from '@/store/fleet';
import type { Reminder } from '@/types';

const TABS = ['Активні', 'Архів'] as const;
/** Скільки днів наперед нагадування вважається «найближчим» */
const SOON_DAYS = 7;

type Group = { key: string; title: string; tone?: 'negative' | 'warning'; items: Reminder[] };

export default function RemindersScreen() {
  const router = useRouter();
  const { cars, reminders } = useFleet();
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);

  const add = () => router.push(cars.length ? '/reminder/new' : '/car/new');
  const active = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date));
  // В архіві спершу найсвіжіші
  const archive = reminders.filter((r) => r.done).sort((a, b) => b.date.localeCompare(a.date));

  // Активні розбиті за терміновістю: те, що горить, окремо від того, що ще далеко
  const groups: Group[] = [
    { key: 'late', title: 'Прострочені', tone: 'negative' as const, items: active.filter((r) => daysUntil(r.date) < 0) },
    { key: 'soon', title: 'Найближчі', tone: 'warning' as const, items: active.filter((r) => daysUntil(r.date) >= 0 && daysUntil(r.date) <= SOON_DAYS) },
    { key: 'later', title: 'Пізніше', items: active.filter((r) => daysUntil(r.date) > SOON_DAYS) },
  ].filter((g) => g.items.length);

  return (
    <Screen>
      {/* «Додати» завжди під рукою в шапці: не доводиться гортати список донизу */}
      <Stack.Screen options={{ title: 'Нагадування', headerBackTitle: 'Назад', headerRight: () => <IconButton icon="add" label="Додати нагадування" onPress={add} /> }} />

      {reminders.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Нагадувань немає"
          text="Додайте дату ТО або страховки — нагадаємо за день і в сам день о 9–10 ранку."
          action="Додати нагадування"
          onAction={add}
        />
      ) : (
        <>
          <Segmented options={TABS} value={tab} onChange={setTab} counts={{ Активні: active.length, Архів: archive.length }} />

          {tab === 'Активні' ? (
            groups.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" title="Усе виконано" text="Активних нагадувань немає. Виконані лежать в архіві." action="Додати нагадування" onAction={add} />
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Тапніть на кружечок, коли ТО чи страховку виконано: нагадування піде в архів.
                </ThemedText>
                {groups.map((g) => (
                  <View key={g.key} style={{ gap: Spacing.two }}>
                    <ThemedText type="smallBold" themeColor={g.tone ?? 'textSecondary'}>
                      {g.title} · {g.items.length}
                    </ThemedText>
                    {g.items.map((r) => (
                      <ReminderRow key={r.id} reminder={r} />
                    ))}
                  </View>
                ))}
              </>
            )
          ) : archive.length === 0 ? (
            <EmptyState icon="archive-outline" title="Архів порожній" text="Тут з’являться нагадування, які ви позначили виконаними." />
          ) : (
            <View style={{ gap: Spacing.two }}>
              {archive.map((r) => (
                <ReminderRow key={r.id} reminder={r} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
