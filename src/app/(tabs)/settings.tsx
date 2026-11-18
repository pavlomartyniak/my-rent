import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Linking, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ScreenTitle } from '@/components/screen-title';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Spacing } from '@/constants/theme';
import { ExportSheet } from '@/components/export-sheet';
import { LegalSheet } from '@/components/legal-sheet';
import { LEGAL_CONTACT } from '@/lib/legal';
import { fullName } from '@/lib/profile';
import { ensureNotificationPermission } from '@/lib/notifications';
import { useAuth } from '@/store/auth';
import { useFleet } from '@/store/fleet';
import { useThemePreference, type ThemePreference } from '@/store/theme';

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: 'Як у телефоні', value: 'system' },
  { label: 'Світла', value: 'light' },
  { label: 'Темна', value: 'dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { role, email, firstName, lastName, phone, photoUri, cars, clearAll, resetHints, setTheme, deleteAccount } = useFleet();
  const { signOut } = useAuth();
  const { preference } = useThemePreference();
  const owner = role === 'owner';
  const [exportOpen, setExportOpen] = useState(false);
  const [doc, setDoc] = useState<'privacy' | 'terms' | null>(null);

  // Кнопка підтвердження називає саме дію («Вийти», «Видалити»), а не «Так»
  const confirm = (title: string, message: string, label: string, action: () => void) =>
    Alert.alert(title, message, [
      { text: 'Скасувати', style: 'cancel' },
      { text: label, style: 'destructive', onPress: action },
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
      <ScreenTitle>Профіль</ScreenTitle>

      <SettingsGroup title="Акаунт">
        <SettingsRow
          icon="person-circle-outline"
          leading={<Avatar uri={photoUri || null} name={fullName({ firstName, lastName }) || email} size={40} />}
          title={fullName({ firstName, lastName }) || email}
          subtitle={fullName({ firstName, lastName }) ? [email, phone].filter(Boolean).join(' · ') : 'Додайте ім’я та прізвище'}
          onPress={() => router.push('/profile')}
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

      <SettingsGroup title={owner ? 'Дані та сповіщення' : 'Дані'}>
        <SettingsRow
          icon="download-outline"
          title="Експорт обліку"
          subtitle="Excel, PDF або CSV з усіма доходами й витратами"
          onPress={() => setExportOpen(true)}
        />
        {owner ? (
          <SettingsRow
            icon="notifications-outline"
            title="Сповіщення"
            subtitle="Дозволити нагадування про ТО й страховку"
            onPress={enableNotifications}
          />
        ) : null}
      </SettingsGroup>
      <LegalSheet doc={doc} onClose={() => setDoc(null)} />
      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} subtitle="Увесь облік за весь час" />

      <SettingsGroup title="Документи">
        <SettingsRow icon="shield-checkmark-outline" title="Політика конфіденційності" onPress={() => setDoc('privacy')} />
        <SettingsRow icon="document-text-outline" title="Умови користування" onPress={() => setDoc('terms')} />
      </SettingsGroup>

      <SettingsGroup title="Допомога">
        <SettingsRow icon="ban-outline" title="Заблоковані користувачі" subtitle="Розблокувати можна тут" onPress={() => router.push('/blocked')} />
        <SettingsRow
          icon="mail-outline"
          title="Написати нам"
          subtitle={LEGAL_CONTACT}
          onPress={() => Linking.openURL(`mailto:${LEGAL_CONTACT}`).catch(() => Alert.alert('Напишіть нам', LEGAL_CONTACT))}
        />
        <SettingsRow
          icon="bulb-outline"
          title="Показати підказки знову"
          subtitle="Повернути закриті підказки на екранах"
          onPress={async () => {
            if (await resetHints()) Alert.alert('Готово', 'Підказки знову з’являться на екранах.');
          }}
        />
      </SettingsGroup>

      <Button title="Вийти з акаунту" icon="log-out-outline" variant="secondary" onPress={() => confirm('Вийти з акаунту?', 'Ваші дані залишаться на сервері. Щоб повернутись, увійдіть із тим самим email і паролем.', 'Вийти', () => void signOut())} />

      <SettingsGroup title="Небезпечна зона">
        {owner ? (
          <SettingsRow
            icon="trash-outline"
            title="Видалити всі дані"
            subtitle="Авто, записи й нагадування буде стерто безповоротно"
            danger
            onPress={() =>
              cars.some((c) => c.status === 'В оренді' || c.status === 'Заброньоване')
                ? Alert.alert('Є авто в оренді', 'Видалити всі дані не можна, поки хоч одне авто в оренді. Спершу завершіть чи розірвіть оренду або змініть статус авто.')
                : confirm('Видалити всі дані?', 'Авто, записи й нагадування буде стерто безповоротно.', 'Видалити все', clearAll)
            }
          />
        ) : null}
        <SettingsRow
          icon="close-circle-outline"
          title="Видалити акаунт"
          subtitle="Акаунт і всі дані буде стерто безповоротно"
          danger
          onPress={() => confirm('Видалити акаунт?', 'Акаунт, авто, записи й нагадування буде стерто безповоротно.', 'Видалити акаунт', () => void deleteAccount())}
        />
      </SettingsGroup>
    </Screen>
  );
}
