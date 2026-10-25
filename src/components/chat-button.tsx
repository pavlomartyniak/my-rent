import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChat } from '@/store/chat';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Кнопка «Повідомлення» з лічильником непрочитаних: стоїть у заголовку кожного головного екрана */
export function ChatButton() {
  const router = useRouter();
  const theme = useTheme();
  const { unread } = useChat();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Повідомлення, непрочитаних: ${unread}` : 'Повідомлення'}
      hitSlop={8}
      onPress={() => router.push('/chats')}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.accentSoft, borderColor: theme.accent }, pressed && styles.pressed]}>
      <Icon name="chatbubbles" size={22} color="accent" />
      {unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.negative }]}>
          <ThemedText style={styles.badgeText}>{unread > 99 ? '99+' : unread}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontWeight: 700 },
});
