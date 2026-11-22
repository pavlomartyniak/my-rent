import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReminderRow } from '@/components/reminder-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil } from '@/lib/date';
import { reminderTitle } from '@/types';
import { useFleet } from '@/store/fleet';
import type { Reminder } from '@/types';

const TABS = ['Активні', 'Архів'] as const;
/** Скільки днів наперед нагадування вважається «найближчим» */
const SOON_DAYS = 7;

type Group = {
  key: string;
  title: string;
  tone?: 'negative' | 'warning';
  items: Reminder[];
};

export default function RemindersScreen() {
  const router = useRouter();
  const { cars, reminders, toggleReminder } = useFleet();
  // Статус після зміни: що сталося й як це скасувати
  const [status, setStatus] = useState<{
    reminder: Reminder;
    done: boolean;
  } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);

  const add = () => router.push(cars.length ? '/reminder/new' : '/car/new');
  const active = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date));
  // В архіві спершу найсвіжіші
  const archive = reminders.filter((r) => r.done).sort((a, b) => b.date.localeCompare(a.date));

  // Активні розбиті за терміновістю: те, що горить, окремо від того, що ще далеко
  const groups: Group[] = [
    {
      key: 'late',
      title: 'Прострочені',
      tone: 'negative' as const,
      items: active.filter((r) => daysUntil(r.date) < 0),
    },
    {
      key: 'soon',
      title: 'Найближчі',
      tone: 'warning' as const,
      items: active.filter((r) => daysUntil(r.date) >= 0 && daysUntil(r.date) <= SOON_DAYS),
    },
    {
      key: 'later',
      title: 'Пізніше',
      items: active.filter((r) => daysUntil(r.date) > SOON_DAYS),
    },
  ].filter((g) => g.items.length);

  return (
    <>
      <Screen>
        {/* «Додати» завжди під рукою в шапці: не доводиться гортати список донизу */}
        <Stack.Screen
          options={{
            title: 'Нагадування',
            headerBackTitle: 'Назад',
            headerRight: () => <IconButton icon="add" label="Додати нагадування" onPress={add} />,
          }}
        />

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
                <EmptyState
                  icon="checkmark-done-outline"
                  title="Усе виконано"
                  text="Активних нагадувань немає. Виконані лежать в архіві."
                  action="Додати нагадування"
                  onAction={add}
                />
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
                        <ReminderRow key={r.id} reminder={r} onToggled={(reminder, done) => setStatus({ reminder, done })} />
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
                  <ReminderRow key={r.id} reminder={r} onToggled={(reminder, done) => setStatus({ reminder, done })} />
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
      {status ? (
        <StatusToast
          key={`${status.reminder.id}-${status.done}`}
          status={status}
          onHide={() => setStatus(null)}
          onUndo={() => {
            setStatus(null);
            void toggleReminder(status.reminder.id);
          }}
          onOpenTarget={() => {
            setStatus(null);
            setTab(status.done ? 'Архів' : 'Активні');
          }}
        />
      ) : null}
    </>
  );
}

/** Статус внизу екрана: «Виконано й перенесено в архів» з кнопками «Скасувати» та «Архів». Зникає сам за 5 секунд */
function StatusToast({
  status,
  onHide,
  onUndo,
  onOpenTarget,
}: {
  status: { reminder: Reminder; done: boolean };
  onHide: () => void;
  onUndo: () => void;
  onOpenTarget: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [show] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    Animated.spring(show, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
    timer.current = setTimeout(onHide, 5000);
    return () => clearTimeout(timer.current);
  }, [show, onHide]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrap,
        {
          bottom: insets.bottom + Spacing.three,
          opacity: show,
          transform: [
            {
              translateY: show.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: theme.ink }]} accessibilityLiveRegion="polite">
        <Icon name={status.done ? 'checkmark-circle' : 'refresh-circle'} size={22} color={theme.onInk} />
        <View style={styles.toastBody}>
          <ThemedText type="smallBold" style={{ color: theme.onInk }} numberOfLines={1}>
            {status.done ? 'Виконано' : 'Повернуто в активні'}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.onInk, opacity: 0.75 }} numberOfLines={1}>
            {reminderTitle(status.reminder)} · {status.done ? 'додано в архів' : 'повернуто з архіву'}
          </ThemedText>
        </View>
        {
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Скасувати" onPress={onUndo} hitSlop={8} style={styles.toastAction}>
              <ThemedText type="smallBold" style={{ color: theme.onInk, textDecorationLine: 'underline' }}>
                Скасувати
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={status.done ? 'Відкрити архів' : 'Відкрити активні'}
              onPress={onOpenTarget}
              hitSlop={8}
              style={styles.toastAction}
            >
              <ThemedText type="smallBold" style={{ color: theme.onInk, textDecorationLine: 'underline' }}>
                {status.done ? 'Архів' : 'Активні'}
              </ThemedText>
            </Pressable>
          </>
        }
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    maxWidth: 480,
    width: '100%',
  },
  toastBody: { flex: 1, minWidth: 0 },
  toastAction: {
    minHeight: 32,
    justifyContent: 'center',
    paddingLeft: Spacing.one,
  },
});
