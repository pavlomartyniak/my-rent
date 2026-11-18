import { Image } from 'expo-image';
import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { downloadChatFile, formatSize, videoPoster } from '@/lib/chat-files';
import type { Attachment } from '@/lib/chat';
import { thumbnailUrl } from '@/lib/media';

import { PhotoViewer } from './photo-viewer';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

const isRemote = (url: string) => url.startsWith('https://');

/** Відкриває файл чи відео в системному переглядачі (для ще не надісланих файлів, що лежать на пристрої, нічого не робить) */
function open(a: Attachment) {
  if (!isRemote(a.url)) return;
  openBrowserAsync(a.url).catch(() => Alert.alert('Не вдалося відкрити файл', a.name));
}

/**
 * Вкладення в бульбашці повідомлення: фото показуються мініатюрами (тап відкриває на весь екран), відео — кадром із кнопкою
 * відтворення, файли — рядком з іконкою, назвою й розміром. Тап по відео й файлу відкриває їх у системному переглядачі.
 */
export function ChatAttachments({ items, mine, chatId, inert }: { items: Attachment[]; mine: boolean; /** Розмова: потрібна, щоб завантажити файл із нашого сервера */ chatId: string; /** Повідомлення ще не надіслано чи не вдалося: вкладення не перехоплюють дотики, тап по бульбашці повторює відправку */ inert?: boolean }) {
  const [viewer, setViewer] = useState<number | null>(null);
  const images = items.filter((a) => a.kind === 'image');
  const fg = mine ? '#FFFFFF' : undefined;
  const sub = mine ? 'rgba(255,255,255,0.8)' : undefined;

  return (
    <View style={styles.wrap} pointerEvents={inert ? 'none' : 'auto'}>
      {items.map((a) => {
        if (a.kind === 'image') {
          return (
            <Pressable key={a.url} accessibilityRole="button" accessibilityLabel={`Фото: ${a.name}`} onPress={() => setViewer(images.findIndex((x) => x.url === a.url))}>
              <Image source={{ uri: isRemote(a.url) ? thumbnailUrl(a.url, 600) : a.url }} style={styles.media} contentFit="cover" />
            </Pressable>
          );
        }
        if (a.kind === 'video') {
          const poster = isRemote(a.url) ? videoPoster(a.url) : undefined;
          return (
            <Pressable key={a.url} accessibilityRole="button" accessibilityLabel={`Відео: ${a.name}`} onPress={() => open(a)} style={[styles.media, styles.video]}>
              {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={styles.play}>
                <Icon name="play" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.size}>
                <ThemedText type="small" style={{ color: '#FFFFFF' }}>
                  {formatSize(a.size)}
                </ThemedText>
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={a.fileId ?? a.url}
            accessibilityRole="button"
            accessibilityLabel={`Файл: ${a.name}`}
            onPress={() => (a.fileId ? void downloadChatFile(chatId, a.fileId, a.name).catch((e) => Alert.alert('Не вдалося відкрити файл', e instanceof Error ? e.message : 'Спробуйте ще раз')) : open(a))}
            style={styles.file}>
            <View style={[styles.fileIcon, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : undefined }]}>
              <Icon name="document-text-outline" size={22} color={fg ?? 'accent'} />
            </View>
            <View style={styles.fileText}>
              <ThemedText type="smallBold" style={fg ? { color: fg } : undefined} numberOfLines={2}>
                {a.name}
              </ThemedText>
              <ThemedText type="small" themeColor={mine ? undefined : 'textSecondary'} style={sub ? { color: sub } : undefined}>
                {formatSize(a.size)}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
      {viewer !== null ? <PhotoViewer photos={images.map((a) => a.url)} startIndex={Math.max(0, viewer)} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  media: { width: 220, height: 160, borderRadius: Radius.md, overflow: 'hidden' },
  video: { backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  play: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  size: { position: 'absolute', right: 8, bottom: 6 },
  file: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minWidth: 200, maxWidth: 240 },
  fileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1, gap: 1 },
});
