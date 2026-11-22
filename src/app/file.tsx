import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isImageFile } from '@/lib/file-viewer';

/** Перегляд файлу (PDF, фото, документ) усередині застосунку. Звідси його ще можна зберегти чи надіслати кнопкою «Поділитись» */
export default function FileViewer() {
  const theme = useTheme();
  const { uri, name, mime } = useLocalSearchParams<{ uri: string; name: string; mime?: string }>();
  const [loading, setLoading] = useState(true);
  const image = isImageFile(name, mime);

  const share = () =>
    void Sharing.shareAsync(uri, { mimeType: mime || undefined, dialogTitle: name }).catch(() => Alert.alert('Не вдалося поділитись файлом', 'Спробуйте ще раз'));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: name, headerBackTitle: 'Назад', headerRight: () => <IconButton icon="share-outline" label="Поділитись" onPress={share} /> }} />
      {image ? (
        <Image source={{ uri }} style={styles.fill} contentFit="contain" />
      ) : Platform.OS === 'ios' ? (
        <>
          <WebView source={{ uri }} originWhitelist={['*']} allowingReadAccessToURL={uri} allowFileAccess style={styles.fill} onLoadEnd={() => setLoading(false)} onError={() => setLoading(false)} />
          {loading ? <ActivityIndicator style={styles.loader} color={theme.accent} /> : null}
        </>
      ) : (
        // Android не вміє показувати PDF у вбудованому вікні: віддаємо системному переглядачу
        <View style={styles.center}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.text}>
            Цей файл відкривається у зовнішньому переглядачі.
          </ThemedText>
          <Button title="Відкрити файл" icon="eye-outline" onPress={share} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  loader: { ...StyleSheet.absoluteFill },
  center: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  text: { textAlign: 'center' },
});
