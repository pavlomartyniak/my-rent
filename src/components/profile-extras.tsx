import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { uploadAvatar } from '@/lib/media';
import { questionsFor, type ProfileExtras } from '@/lib/profile';

import { Avatar } from './avatar';
import { ThemedText } from './themed-text';
import { CityField } from './place-field';
import { ChoiceChips } from './ui/choice-chips';
import { Field } from './ui/field';
import { Icon } from './ui/icon';
import { NumberField } from './ui/number-field';

const THIS_YEAR = new Date().getFullYear();

/** Помилка року водіння (порожнє поле допустиме) */
export const drivingYearError = (value: number | null) => (value === null ? '' : value < 1950 ? 'Рік не раніше 1950' : value > THIS_YEAR ? 'Рік не може бути в майбутньому' : '');

/**
 * Необов'язкові дані профілю: фото, місто, кілька слів про себе, рік початку водіння й (для орендаря) для чого орендує.
 * Однакова форма в онбордингу й у «Профілі». Стан тримає батьківський екран.
 */
export function ProfileExtrasForm({ value, onChange, name, renter, submitted }: { value: ProfileExtras; onChange: (patch: Partial<ProfileExtras>) => void; name: string; renter: boolean; submitted?: boolean }) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    const url = await uploadAvatar(result.assets[0].uri);
    setUploading(false);
    if (url) onChange({ photoUri: url });
    else Alert.alert('Не вдалося завантажити фото', 'Спробуйте ще раз пізніше.');
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.photo}>
        <Pressable accessibilityRole="button" accessibilityLabel="Змінити фото профілю" onPress={() => void pick()} disabled={uploading}>
          <Avatar uri={value.photoUri || null} name={name || 'Профіль'} size={96} />
          <View style={[styles.camera, { backgroundColor: theme.accent, borderColor: theme.background }]}>
            {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="camera" size={16} color="#FFFFFF" />}
          </View>
        </Pressable>
        <View style={styles.photoText}>
          <ThemedText type="default" style={{ fontWeight: 600 }}>
            Фото профілю
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            З фото більше довіри: люди охочіше пишуть тим, кого бачать.
          </ThemedText>
          {value.photoUri ? (
            <Pressable accessibilityRole="button" onPress={() => onChange({ photoUri: '' })} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="negative">
                Прибрати фото
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <CityField label="Місто (необов’язково)" value={value.city} onChange={(city) => onChange({ city })} clearable />
      <Field
        label="Про себе (необов’язково)"
        value={value.about}
        onChangeText={(about) => onChange({ about })}
        multiline
        maxLength={300}
        placeholder={renter ? 'Кілька слів про себе: що важливо знати власнику авто' : 'Умови оренди, як швидко відповідаєте, що важливо для вас…'}
        style={{ minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
        {value.about.length} / 300
      </ThemedText>
      <NumberField
        label="З якого року ви водите авто? (необов’язково)"
        value={value.drivingSince === null ? '' : String(value.drivingSince)}
        onChangeValue={(d) => onChange({ drivingSince: d ? Number(d) : null })}
        maxDigits={4}
        placeholder="Наприклад, 2015"
        plain
        error={submitted ? drivingYearError(value.drivingSince) || undefined : undefined}
      />

      {questionsFor(renter ? 'renter' : 'owner').map((q) =>
        q.multi ? (
          <ChoiceChips key={q.key} multi label={q.label} hint={q.hint} options={q.options} value={value[q.key] as string[]} onChange={(v) => onChange({ [q.key]: v })} />
        ) : (
          <ChoiceChips key={q.key} label={q.label} hint={q.hint} options={q.options} value={value[q.key] as string} onChange={(v) => onChange({ [q.key]: v })} />
        ),
      )}
      <ThemedText type="callout" themeColor="textSecondary">
        {renter
          ? 'Ці відповіді власник авто побачить у вашому профілі в розділі «Відомості» з позначкою «зі слів користувача». Чим більше відповідей, тим охочіше власники приймають запити.'
          : 'Ці відповіді орендар побачить у вашому профілі в розділі «Відомості» з позначкою «зі слів користувача». Чим більше відповідей, тим охочіше орендарі надсилають запити.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  photo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photoText: { flex: 1, gap: 2 },
  camera: { position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  counter: { textAlign: 'right', marginTop: -Spacing.two },
});
