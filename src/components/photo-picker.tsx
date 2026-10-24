import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { uploadPhotos } from '@/lib/media';
import { plural } from '@/lib/format';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { IconButton } from './ui/icon-button';

export const MAX_PHOTOS = 10;

type Props = { value: string[]; onChange: (photos: string[]) => void; error?: string };

/** Галерея фото авто: кілька фото одразу з галереї або знімок з камери; перше фото — обкладинка */
export function PhotoPicker({ value, onChange, error }: Props) {
  const theme = useTheme();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const uploading = progress !== null;
  const room = MAX_PHOTOS - value.length;

  /** Фото потрібні й іншим користувачам (оголошення), тому одразу завантажуємо їх у хмару */
  async function accept(localUris: string[]) {
    if (!localUris.length) return;
    setProgress({ done: 0, total: localUris.length });
    try {
      const res = await uploadPhotos(localUris, (done, total) => setProgress({ done, total }));
      if (res.unavailable) {
        // Хмара не налаштована: лишаємо локальні фото, їх бачить лише власник
        onChange([...value, ...localUris]);
        Alert.alert('Фото збережено лише на цьому телефоні', 'Завантаження в хмару не налаштоване, тому орендарі ці фото не побачать.');
        return;
      }
      if (res.urls.length) onChange([...value, ...res.urls]);
      if (res.failed) {
        Alert.alert('Не всі фото завантажено', `Не вдалося завантажити ${res.failed} з ${localUris.length}. Додайте їх ще раз.`);
      }
    } catch (e) {
      Alert.alert('Не вдалося завантажити фото', e instanceof Error ? e.message : 'Спробуйте ще раз');
    } finally {
      setProgress(null);
    }
  }

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Немає доступу до камери', 'Дозвольте камеру для застосунку в налаштуваннях телефону.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) await accept(result.assets.map((a) => a.uri));
  }

  async function fromLibrary() {
    // Кілька фото одразу; обрізання (allowsEditing) із множинним вибором не поєднується
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) await accept(result.assets.slice(0, room).map((a) => a.uri));
  }

  const makeCover = (i: number) => onChange([value[i], ...value.filter((_, k) => k !== i)]);
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        Фото авто{value.length ? ` · ${value.length} з ${MAX_PHOTOS}` : ''}
      </ThemedText>

      <CarPhoto
        uri={value[0]}
        style={styles.preview}
        iconSize={40}
        placeholder={uploading ? `Завантажуємо ${Math.min(progress.done + 1, progress.total)} з ${progress.total}…` : 'Фото ще не додано'}
      />

      {value.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {value.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i === 0 ? 'Обкладинка' : 'Зробити обкладинкою'}
                  disabled={uploading}
                  onPress={() => i > 0 && makeCover(i)}>
                  <CarPhoto uri={uri} style={[styles.thumb, i === 0 && { borderColor: theme.accent, borderWidth: 2 }]} iconSize={20} />
                </Pressable>
                {i === 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                    <ThemedText type="small" style={styles.badgeText}>
                      Обкладинка
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.remove}>
                  <IconButton icon="close" label="Видалити фото" tone="negative" size={26} disabled={uploading} onPress={() => remove(i)} />
                </View>
              </View>
            ))}
          </ScrollView>
          <ThemedText type="small" themeColor="textSecondary">
            Торкніться фото, щоб зробити його обкладинкою.
          </ThemedText>
        </>
      ) : null}

      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.row}>
        <Button title="Камера" icon="camera-outline" variant="secondary" style={styles.flex} disabled={uploading || room <= 0} onPress={fromCamera} />
        <Button title="Галерея" icon="images-outline" variant="secondary" style={styles.flex} disabled={uploading || room <= 0} onPress={fromLibrary} />
      </View>
      {room <= 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Досягнуто ліміту: {MAX_PHOTOS} {plural(MAX_PHOTOS, 'фото', 'фото', 'фото')}. Видаліть зайві, щоб додати нові.
        </ThemedText>
      ) : null}
    </View>
  );
}

const THUMB_W = 96;

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  strip: { gap: Spacing.two, paddingTop: Spacing.one, paddingRight: Spacing.two },
  thumbWrap: { width: THUMB_W },
  thumb: { width: THUMB_W, height: 72, borderRadius: Radius.sm },
  badge: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 6, borderRadius: Radius.pill },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 15, fontWeight: 700 },
  remove: { position: 'absolute', right: -6, top: -6 },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
