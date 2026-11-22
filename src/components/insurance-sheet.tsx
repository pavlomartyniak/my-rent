import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, BASE_URL, getApiToken } from '@/lib/api';
import { formatSize } from '@/lib/format';
import { downloadPolicy, type PolicyInfo, pickPolicy, uploadPolicy } from '@/lib/insurance';

import { ThemedText } from './themed-text';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Нижній лист страхового полісу авто: власник завантажує файл (PDF чи фото до 8 МБ), може замінити чи видалити його; орендар з
 * чинною орендою цього авто бачить поліс і може його завантажити. Дати дії полісу не збираємо: важливий сам файл. Файл віддає
 * лише власнику й орендарю: публічного посилання на нього немає.
 */
export function InsuranceSheet({ carId, data, visible, onClose, onChanged }: { carId: string; data: PolicyInfo; visible: boolean; onClose: () => void; onChanged: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = useState<'upload' | 'download' | 'remove' | null>(null);

  async function pick() {
    const a = await pickPolicy();
    if (!a) return;
    setBusy('upload');
    try {
      await uploadPolicy(carId, a);
      onChanged();
    } catch (e) {
      Alert.alert('Не вдалося завантажити поліс', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    if (!data.hasPolicy) return;
    setBusy('download');
    try {
      await downloadPolicy(carId, data.mime);
    } catch (e) {
      Alert.alert('Не вдалося відкрити поліс', e instanceof Error ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  const remove = () =>
    Alert.alert('Видалити поліс?', 'Файл буде видалено з Kolo. Орендар більше не зможе його завантажити.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          setBusy('remove');
          try {
            await api('DELETE', `/insurance/cars/${carId}`);
            onChanged();
            onClose();
          } catch (e) {
            Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <BottomSheet visible={visible} onClose={onClose} locked={busy !== null}>
      <ThemedText type="title" accessibilityRole="header">
        Страховий поліс
      </ThemedText>

      {data.hasPolicy ? (
        <View style={styles.file}>
          <View style={[styles.icon, { backgroundColor: theme.positiveSoft }]}>
            <Icon name={data.mime === 'application/pdf' ? 'document-text' : 'image'} size={22} color="positive" />
          </View>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="positive" style={styles.name}>
              Файл додано
            </ThemedText>
            <ThemedText type="body" style={styles.name} numberOfLines={2}>
              {data.name}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary">
              {formatSize(data.size)}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText type="body" themeColor="textSecondary">
          Додайте страховий поліс (PDF чи фото): орендар зможе завантажити його зі сторінки оренди.
        </ThemedText>
      )}

      {data.hasPolicy && data.mime.startsWith('image/') ? (
        <Image
          source={{ uri: `${BASE_URL}/insurance/cars/${carId}/file`, headers: { Authorization: `Bearer ${getApiToken() ?? ''}` }, cacheKey: `policy-${carId}-${data.uploadedAt}` }}
          style={styles.preview}
          contentFit="cover"
          accessibilityLabel="Попередній перегляд полісу"
        />
      ) : null}

      {data.hasPolicy ? <Button title="Переглянути поліс" icon="eye-outline" loading={busy === 'download'} disabled={busy !== null} onPress={() => void download()} /> : null}
      {data.canEdit ? (
        <>
          <Button
            title={data.hasPolicy ? 'Замінити файл' : 'Завантажити поліс'}
            icon="cloud-upload-outline"
            variant={data.hasPolicy ? 'secondary' : 'primary'}
            loading={busy === 'upload'}
            disabled={busy !== null}
            onPress={() => void pick()}
          />
          {data.hasPolicy ? <Button title="Видалити поліс" icon="trash-outline" variant="danger" disabled={busy !== null} loading={busy === 'remove'} onPress={remove} /> : null}
        </>
      ) : null}
      <Button title="Закрити" variant="tertiary" disabled={busy !== null} onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  file: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  name: { fontWeight: 600 },
  preview: { width: '100%', height: 200, borderRadius: Radius.md },
});
