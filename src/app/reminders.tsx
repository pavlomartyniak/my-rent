import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Hint } from '@/components/hint';
import { ReminderRow } from '@/components/reminder-row';
import { ScreenTitle } from '@/components/screen-title';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useFleet } from '@/store/fleet';

export default function RemindersScreen() {
  const router = useRouter();
  const { cars, reminders } = useFleet();

  // Невиконані за датою, виконані внизу
  const sorted = [...reminders].sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  const add = () => router.push(cars.length ? '/reminder/new' : '/car/new');

  return (
    <Screen tabs>
      <ScreenTitle>Нагадування</ScreenTitle>

      {sorted.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Нагадувань немає"
          text="Додайте дату ТО або страховки — нагадаємо за день і в сам день."
          action="Додати нагадування"
          onAction={add}
        />
      ) : (
        <>
          <Hint id="reminders">Тапніть на кружечок, коли ТО чи страховку виконано. Нагадування прийде за день і в сам день о 9–10 ранку.</Hint>
          <View style={{ gap: Spacing.two }}>
            {sorted.map((r) => (
              <ReminderRow key={r.id} reminder={r} />
            ))}
          </View>
          <Button title="Додати нагадування" icon="add" onPress={add} />
        </>
      )}
    </Screen>
  );
}
