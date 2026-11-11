import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { todayISO } from '@/lib/date';
import { ID_DOC_LABELS, PARTY_LABELS, type LegalProfile } from '@/lib/legal-profile';
import { useFleet } from '@/store/fleet';

type Me = { role: 'owner' | 'renter'; firstName: string; lastName: string; legal?: LegalProfile; legalMissing: string[] };

const EMPTY: LegalProfile = {
  partyType: 'individual',
  middleName: '',
  rnokpp: '',
  idDoc: { type: 'id_card', series: '', number: '', issuedBy: '', issuedAt: '' },
  address: '',
};

/**
 * Дані для договору: ПІБ повністю, статус, РНОКПП, документ, адреса, для орендаря — посвідчення водія.
 * Без них у договорі не визначені сторони. Другій стороні ці дані видно лише в договорі після домовленості.
 */
export default function LegalScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { invalidate, reload } = useFleet();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<LegalProfile>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api<Me>('GET', '/me')
      .then((m) => {
        setMe(m);
        if (m.legal) setForm({ ...EMPTY, ...m.legal, idDoc: { ...EMPTY.idDoc, ...m.legal.idDoc } });
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Не вдалося завантажити'));
  }, []);

  const set = (patch: Partial<LegalProfile>) => setForm((f) => ({ ...f, ...patch }));
  const setDoc = (patch: Partial<LegalProfile['idDoc']>) => setForm((f) => ({ ...f, idDoc: { ...f.idDoc, ...patch } }));

  async function save() {
    if (saving) return;
    setSaving(true);
    setProblems([]);
    try {
      // Посвідчення водія зберігається окремо, у профілі
      await api('PUT', '/me/legal', { ...form, license: undefined });
      invalidate();
      reload();
      Alert.alert('Збережено', 'Дані для договору заповнено.');
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setProblems(e.details?.length ? e.details : [e.message]);
      else Alert.alert('Не вдалося зберегти', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setSaving(false);
    }
  }

  if (!me) {
    return (
      <Screen>
        <ThemedText type="small" themeColor="textSecondary">
          {loadError || 'Завантажуємо…'}
        </ThemedText>
      </Screen>
    );
  }

  const isRenter = me.role === 'renter';
  const doc = form.idDoc;

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">Навіщо ці дані</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Вони потрібні, щоб у договорі були визначені сторони{isRenter ? ' і водій' : ' й авто'}. Другій стороні вони видні лише в договорі після домовленості, в пошуку й чаті їх немає. Вказуйте правдиві дані: за ними складається договір.
        </ThemedText>
      </Card>

      <View style={styles.group}>
        <ThemedText type="smallBold">Статус</ThemedText>
        <Segmented options={Object.values(PARTY_LABELS)} value={PARTY_LABELS[form.partyType]} onChange={(l) => set({ partyType: l === PARTY_LABELS.fop ? 'fop' : 'individual' })} />
        <ThemedText type="small" themeColor="textSecondary">
          Статус записується в договір.
        </ThemedText>
      </View>
      {form.partyType === 'fop' ? <Field label="Основний КВЕД" value={form.kved ?? ''} onChangeText={(v) => set({ kved: v })} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="49.32" /> : null}

      <ThemedText type="small" themeColor="textSecondary">
        Прізвище та ім’я беруться з профілю: {me.lastName} {me.firstName}.
      </ThemedText>
      <Field label="По батькові" value={form.middleName} onChangeText={(v) => set({ middleName: v })} autoCapitalize="words" maxLength={50} placeholder="Іванович" />
      <Field label="РНОКПП (ІПН)" value={form.rnokpp} onChangeText={(v) => set({ rnokpp: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={10} placeholder="10 цифр" />

      <View style={styles.group}>
        <ThemedText type="smallBold">Документ, що посвідчує особу</ThemedText>
        <Segmented options={Object.values(ID_DOC_LABELS)} value={ID_DOC_LABELS[doc.type]} onChange={(l) => setDoc({ type: l === ID_DOC_LABELS.passport_book ? 'passport_book' : 'id_card' })} />
      </View>
      {doc.type === 'passport_book' ? <Field label="Серія паспорта" value={doc.series} onChangeText={(v) => setDoc({ series: v.toUpperCase() })} autoCapitalize="characters" maxLength={2} placeholder="АА" /> : null}
      <Field label={doc.type === 'passport_book' ? 'Номер паспорта' : 'Номер ID-картки'} value={doc.number} onChangeText={(v) => setDoc({ number: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={doc.type === 'passport_book' ? 6 : 9} placeholder={doc.type === 'passport_book' ? '6 цифр' : '9 цифр'} />
      <Field label="Ким виданий (орган чи номер)" value={doc.issuedBy} onChangeText={(v) => setDoc({ issuedBy: v })} maxLength={120} placeholder={doc.type === 'id_card' ? '1234' : 'Шевченківським РУ ГУ ДМС'} />
      <DateField label="Дата видачі" value={doc.issuedAt || todayISO()} onChange={(iso) => setDoc({ issuedAt: iso })} />
      <Field label="Адреса проживання" value={form.address} onChangeText={(v) => set({ address: v })} maxLength={200} multiline placeholder="м. Київ, вул. Хрещатик, 1, кв. 2" style={{ minHeight: 64, textAlignVertical: 'top', paddingTop: 12 }} />

      {isRenter ? (
        <Card>
          <ThemedText type="smallBold">Посвідчення водія</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Серію, номер, категорії та строк дії посвідчення додають у профілі. Без них запит на авто чи заявку не надіслати.
          </ThemedText>
          <Button title="Відкрити профіль" icon="person-circle-outline" variant="secondary" onPress={() => router.push('/profile')} />
        </Card>
      ) : null}

      {problems.length ? (
        <Card style={{ backgroundColor: theme.warningSoft }}>
          <ThemedText type="smallBold" themeColor="warning">
            Перевірте дані
          </ThemedText>
          {problems.map((p) => (
            <ThemedText key={p} type="small">
              • {p}
            </ThemedText>
          ))}
        </Card>
      ) : null}

      <Button title={saving ? 'Зберігаємо…' : 'Зберегти'} disabled={saving} onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.one },
});
