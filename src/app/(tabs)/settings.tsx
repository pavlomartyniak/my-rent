import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { exportCsv } from '@/lib/export';
import { fullName } from '@/lib/profile';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useAuth } from '@/store/auth';
import { useFleet } from '@/store/fleet';
import { useThemePreference, type ThemePreference } from '@/store/theme';
import { PRO_CAR_LIMIT } from '@/types';

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: 'Як у телефоні', value: 'system' },
  { label: 'Світла', value: 'light' },
  { label: 'Темна', value: 'dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { role, email, firstName, lastName, phone, cars, isPro, carLimit, setPro, clearAll, resetHints, setTheme, deleteAccount } = useFleet();
  const { signOut } = useAuth();
  const { preference } = useThemePreference();
  const owner = role === 'owner';

  const confirm = (title: string, message: string, action: () => void) =>
    Alert.alert(title, message, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Так', style: 'destructive', onPress: action },
    ]);

  async function enableNotifications() {
    const ok = await ensureNotificationPermission();
    Alert.alert(
      ok ? 'Сповіщення увімкнено' : 'Немає дозволу',
      ok ? 'Нагадування про ТО й страховку надходитимуть на цей телефон.' : 'Дозвольте сповіщення для застосунку в налаштуваннях телефону.',
    );
  }

  return (
    <Screen tabs gap={Spacing.four}>
      <ScreenTitle>Налаштування</ScreenTitle>

      <SettingsGroup title="Акаунт">
        <SettingsRow
          icon="person-circle-outline"
          title={fullName({ firstName, lastName }) || email}
          subtitle={fullName({ firstName, lastName }) ? [email, phone].filter(Boolean).join(' · ') : 'Додайте ім’я та прізвище'}
          onPress={() => router.push('/profile')}
        />
        <SettingsRow
          icon="log-out-outline"
          title="Вийти з акаунту"
          subtitle="Ваші дані залишаться на сервері"
          onPress={() => confirm('Вийти з акаунту?', 'Щоб повернутись, увійдіть із тим самим email і паролем.', () => void signOut())}
        />
        <SettingsRow
          icon="close-circle-outline"
          title="Видалити акаунт"
          subtitle="Акаунт і всі дані буде стерто безповоротно"
          danger
          onPress={() => confirm('Видалити акаунт?', 'Акаунт, авто, записи й нагадування буде стерто безповоротно.', () => void deleteAccount())}
        />
      </SettingsGroup>

      <SettingsGroup title="Вигляд">
        <View style={{ gap: Spacing.two, paddingVertical: Spacing.three }}>
          <ThemedText type="default" style={{ fontWeight: 600 }}>
            Тема оформлення
          </ThemedText>
          <Segmented
            options={THEMES.map((t) => t.label)}
            value={THEMES.find((t) => t.value === preference)?.label ?? THEMES[0].label}
            onChange={(label) => void setTheme(THEMES.find((t) => t.label === label)?.value ?? 'system')}
          />
        </View>
      </SettingsGroup>

      {owner ? (
        <SettingsGroup title="Тариф">
          <SettingsRow
            icon="diamond-outline"
            title={isPro ? 'Тариф Pro' : 'Тариф Free'}
            subtitle={isPro ? `Авто: ${cars.length} з ${carLimit}` : `Авто: ${cars.length} з ${carLimit}. У Pro — до ${PRO_CAR_LIMIT} авто`}
            onPress={() => (isPro ? void setPro(false) : router.push('/paywall'))}
          />
        </SettingsGroup>
      ) : null}

      {owner ? (
        <SettingsGroup title="Дані та сповіщення">
          <SettingsRow
            icon="download-outline"
            title="Експорт у CSV"
            subtitle="Поділитися всіма доходами й витратами у вигляді таблиці"
            onPress={() =>
              exportCsv().catch((e) => Alert.alert('Не вдалося експортувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз'))
            }
          />
          <SettingsRow
            icon="notifications-outline"
            title="Сповіщення"
            subtitle="Дозволити нагадування про ТО й страховку"
            onPress={enableNotifications}
          />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Допомога">
        <SettingsRow
          icon="bulb-outline"
          title="Показати підказки знову"
          subtitle="Повернути закриті підказки на екранах"
          onPress={async () => {
            if (await resetHints()) Alert.alert('Готово', 'Підказки знову з’являться на екранах.');
          }}
        />
      </SettingsGroup>

      {owner ? (
        <SettingsGroup title="Дані застосунку">
          <SettingsRow
            icon="trash-outline"
            title="Видалити всі дані"
            subtitle="Авто, записи й нагадування буде стерто безповоротно"
            danger
            onPress={() => confirm('Видалити всі дані?', 'Авто, записи й нагадування буде стерто безповоротно.', clearAll)}
          />
        </SettingsGroup>
      ) : null}
    </Screen>
  );
}
