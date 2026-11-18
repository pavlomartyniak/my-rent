import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate, todayISO } from '@/lib/date';
import { formatSize } from '@/lib/format';
import { downloadPolicy, type PolicyInfo, pickPolicy, uploadPolicy } from '@/lib/insurance';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DateField } from './ui/date-field';
import { Icon } from './ui/icon';

/**
 * Страховий поліс авто. Власник завантажує файл (PDF чи фото до 8 МБ), за потреби вказує, до якої дати він діє, може замінити
 * чи видалити його. Орендар з чинною орендою цього авто бачить поліс і може його завантажити. Файл віддає лише сервер
 * власнику й орендарю: публічного посилання на нього немає.
 */
export function InsuranceCard({ carId }: { carId: string }) {
  const theme = useTheme();
  const { data, retry } = useReport<PolicyInfo>(`/insurance/cars/${carId}`, { refetchOnFocus: true, useCache: false });
  const [busy, setBusy] = useState<'upload' | 'download' | 'remove' | null>(null);
  const [validUntil, setValidUntil] = useState<string | null | undefined>(undefined);

  if (!data) return null;
  // Орендарю без полісу нічого показувати не треба; власнику — кнопка додати
  if (!data.hasPolicy && !data.canEdit) {
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Власник ще не додав страховий поліс.
        </ThemedText>
      </Card>
    );
  }

  const dateValue = validUntil !== undefined ? validUntil : data.hasPolicy ? data.validUntil : null;

  async function pick() {
    const a = await pickPolicy();
    if (!a) return;
    setBusy('upload');
    try {
      await uploadPolicy(carId, a, dateValue);
      setValidUntil(undefined);
      retry();
    } catch (e) {
      Alert.alert('Не вдалося завантажити поліс', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  async function saveDate(next: string | null) {
    setValidUntil(next);
    if (!data?.hasPolicy) return;
    try {
      await api('PATCH', `/insurance/cars/${carId}`, { validUntil: next });
      retry();
    } catch (e) {
      Alert.alert('Не вдалося зберегти дату', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    }
  }

  async function download() {
    if (!data?.hasPolicy) return;
    setBusy('download');
    try {
      await downloadPolicy(carId, data.mime);
    } catch (e) {
      Alert.alert('Не вдалося завантажити поліс', e instanceof Error ? e.message : 'Спробуйте ще раз');
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
            setValidUntil(undefined);
            retry();
          } catch (e) {
            Alert.alert('Не вдалося видалити', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);

  return (
    <Card style={styles.card}>
      {data.hasPolicy ? (
        <>
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: data.expired ? theme.negativeSoft : theme.positiveSoft }]}>
              <Icon name={data.mime === 'application/pdf' ? 'document-text' : 'image'} size={22} color={data.expired ? 'negative' : 'positive'} />
            </View>
            <View style={styles.flex}>
              <ThemedText type="default" style={styles.bold} numberOfLines={2}>
                {data.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatSize(data.size)} · додано {formatDate(data.uploadedAt.slice(0, 10))}
              </ThemedText>
              {data.validUntil ? (
                <ThemedText type="smallBold" themeColor={data.expired ? 'negative' : 'positive'}>
                  {data.expired ? 'Не діє з' : 'Діє до'} {formatDate(data.validUntil)}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <Button title={busy === 'download' ? 'Завантажуємо…' : 'Завантажити поліс'} icon="download-outline" disabled={busy !== null} onPress={() => void download()} />
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Додайте страховий поліс (PDF чи фото): орендар зможе завантажити його зі сторінки оренди.
        </ThemedText>
      )}

      {data.canEdit ? (
        <>
          <DateField label={dateValue ? 'Діє до' : 'Діє до (не вказано, оберіть дату)'} value={dateValue ?? todayISO()} onChange={(d) => void saveDate(d)} />
          <View style={styles.row}>
            <Button
              title={busy === 'upload' ? 'Завантажуємо…' : data.hasPolicy ? 'Замінити файл' : 'Завантажити поліс'}
              icon="cloud-upload-outline"
              variant={data.hasPolicy ? 'secondary' : 'primary'}
              style={styles.flex}
              disabled={busy !== null}
              onPress={() => void pick()}
            />
            {data.hasPolicy ? <Button title="Видалити" icon="trash-outline" variant="danger" disabled={busy !== null} onPress={remove} /> : null}
          </View>
          {busy === 'upload' ? <ActivityIndicator /> : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  row: { flexDirection: 'row', gap: Spacing.two },
});
