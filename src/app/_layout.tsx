import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';
import '@/lib/notifications';
import { AuthProvider, useAuth } from '@/store/auth';
import { ChatProvider } from '@/store/chat';
import { FleetProvider, useFleet } from '@/store/fleet';
import { ThemePreferenceProvider } from '@/store/theme';

SplashScreen.preventAutoHideAsync();

const navTheme = (scheme: 'light' | 'dark') => {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[scheme];
  return {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.backgroundElement, text: c.text, border: c.border },
  };
};

function Routes() {
  const { status, signOut } = useAuth();
  const { ready, onboarded, role, loadError, reload } = useFleet();

  if (status === 'loading') return null;

  const authed = status === 'in';

  // Після входу чекаємо на дані із сервера; якщо не вдалося — даємо спробувати ще раз
  if (authed && !ready) {
    if (!loadError) return null;
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four }}>
        <ThemedText type="subtitle">Не вдалося завантажити дані</ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {loadError}
        </ThemedText>
        <Button title="Спробувати ще раз" onPress={reload} />
        <Button title="Вийти з акаунту" variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  }

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Protected guard={!authed}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={authed && !onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Власник авто: облік, звіти, оголошення й запити на оренду */}
        <Stack.Protected guard={authed && onboarded && role === 'owner'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="car/[id]" options={{ title: 'Авто', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="car/analytics" options={{ title: 'Аналітика', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="car/new" options={{ title: 'Нове авто', presentation: 'modal' }} />
          <Stack.Screen name="car/listing" options={{ title: 'Оголошення', presentation: 'modal' }} />
          <Stack.Screen name="car/edit" options={{ title: 'Редагувати авто', presentation: 'modal' }} />
          <Stack.Screen name="reminder/new" options={{ title: 'Нове нагадування', presentation: 'modal' }} />
          <Stack.Screen name="paywall" options={{ title: 'Pro', presentation: 'modal' }} />
          <Stack.Screen name="wanted/offer" options={{ title: 'Пропозиція орендарю', presentation: 'modal' }} />
        </Stack.Protected>
        {/* Орендар: пошук авто й запити */}
        <Stack.Protected guard={authed && onboarded && role === 'renter'}>
          <Stack.Screen name="renter" options={{ headerShown: false }} />
          <Stack.Screen name="market/[id]" options={{ title: 'Авто', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="market/request" options={{ title: 'Запит на оренду', presentation: 'modal' }} />
          <Stack.Screen name="wanted/new" options={{ title: 'Шукаю авто', presentation: 'modal' }} />
          <Stack.Screen name="wanted/[id]" options={{ title: 'Шукаю авто', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="rentals/archive" options={{ title: 'Усі оренди', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="deals/[id]" options={{ title: 'Оренда', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="deals/analytics" options={{ title: 'Аналітика', headerBackTitle: 'Назад' }} />
        </Stack.Protected>
        {/* Спільне для обох ролей; стоїть останнім, щоб не ставати стартовим екраном */}
        <Stack.Protected guard={authed && onboarded}>
          <Stack.Screen name="contracts/[id]" options={{ title: 'Договір', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="chats/index" options={{ title: 'Повідомлення', headerBackTitle: 'Назад' }} />
          <Stack.Screen name="chats/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="car/pick" options={{ title: 'Вибір', presentation: 'modal' }} />
          <Stack.Screen name="transaction/new" options={{ title: 'Новий запис', presentation: 'modal' }} />
          <Stack.Screen name="transaction/[id]" options={{ title: 'Запис', presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ title: 'Профіль', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <ThemePreferenceProvider>
      <ThemeProvider value={navTheme(scheme)}>
        <AuthProvider>
          <FleetProvider>
            <ChatProvider>
              <Routes />
            </ChatProvider>
          </FleetProvider>
        </AuthProvider>
      </ThemeProvider>
    </ThemePreferenceProvider>
  );
}
