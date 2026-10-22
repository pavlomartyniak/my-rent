import * as ImagePicker from 'expo-image-picker';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';

type Props = { value?: string; onChange: (uri?: string) => void; error?: string };

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [16, 9],
  quality: 0.7,
};

/** Вибір фото авто: з камери або з галереї */
export function PhotoPicker({ value, onChange, error }: Props) {
  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Немає доступу до камери', 'Дозвольте камеру для застосунку в налаштуваннях телефону.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(OPTIONS);
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  async function fromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        Фото авто
      </ThemedText>
      <CarPhoto uri={value} style={styles.preview} iconSize={40} placeholder="Фото ще не додано" />
      {error ? (
        <ThemedText type="small" themeColor="negative">
          {error}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <Button title="Камера" icon="camera-outline" variant="secondary" style={styles.flex} onPress={fromCamera} />
        <Button title="Галерея" icon="images-outline" variant="secondary" style={styles.flex} onPress={fromLibrary} />
      </View>
      {value ? <Button title="Видалити фото" variant="danger" onPress={() => onChange(undefined)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
