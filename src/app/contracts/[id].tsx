import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ReportStatus } from '@/components/report-status';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useReport } from '@/hooks/use-report';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { downloadContractPdf, METHOD_LABEL, type ContractSignature, type ContractView } from '@/lib/contract';
import { formatDate } from '@/lib/date';
import { useFleet } from '@/store/fleet';

/** Договір оренди: текст, підписи сторін, підписання й завантаження PDF */
export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { invalidate, reload, role } = useFleet();
  const { data, loading, error, retry } = useReport<ContractView>(`/deals/${id}/contract`, { useCache: false, refetchOnFocus: true });
  const [busy, setBusy] = useState<'sign' | 'pdf' | 'cancel' | null>(null);

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Договір', headerBackTitle: 'Назад' }} />
        <ReportStatus loading={loading} error={error} onRetry={retry} />
      </Screen>
    );
  }

  const awaiting = data.status === 'awaiting';
  const state = data.signing.state;
  const canSign = awaiting && !data.mySigned && state === 'open';

  async function run(kind: 'sign' | 'cancel', fn: () => Promise<unknown>, failTitle: string) {
    setBusy(kind);
    try {
      await fn();
      invalidate();
      reload();
      retry();
    } catch (e) {
      Alert.alert(failTitle, e instanceof ApiError ? e.message : 'Спробуйте ще раз');
      retry();
    } finally {
      setBusy(null);
    }
  }

  const confirmSign = () =>
    Alert.alert(
      'Підписати договір?',
      'Підписуйте договір під час зустрічі, коли власник передає авто й ключі, а орендар — гроші. Підписуючи, ви підтверджуєте, що ознайомились із текстом і погоджуєтесь з умовами. Оренда почнеться, коли договір підпишуть обидві сторони.',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Підписати', onPress: () => void run('sign', () => api('POST', `/deals/${id}/sign`), 'Не вдалося підписати') },
      ],
    );

  const confirmCancel = () =>
    Alert.alert('Скасувати домовленість?', 'Договір не буде підписано, авто знову стане вільним, а друга сторона побачить скасування.', [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Скасувати домовленість',
        style: 'destructive',
        onPress: () =>
          void run('cancel', () => api('POST', `/deals/${id}/cancel-agreement`, {}), 'Не вдалося скасувати').then(() => router.back()),
      },
    ]);

  async function pdf() {
    setBusy('pdf');
    try {
      await downloadContractPdf(data!.dealId, data!.number);
    } catch (e) {
      Alert.alert('Не вдалося відкрити PDF', e instanceof Error ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Договір', headerBackTitle: 'Назад' }} />

      <Card>
        <View style={styles.head}>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Договір оренди транспортного засобу
            </ThemedText>
            <ThemedText type="subtitle">№ {data.number}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              від {formatDate(data.createdAt.slice(0, 10))}
            </ThemedText>
          </View>
          <StatusBadge status={awaiting ? 'signing' : data.status === 'terminated' ? 'terminated' : 'accepted'} />
        </View>
        <ThemedText type="default" style={styles.bold}>
          {data.terms.car.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(data.terms.startDate)} – {formatDate(data.terms.endDate)} · {data.terms.days} діб · {Math.round(data.terms.pricePerDay)} грн/доба
        </ThemedText>
      </Card>

      <SignatureRow label="Орендодавець" name={data.terms.owner.name} signature={data.signatures.owner} you={role === 'owner'} />
      <SignatureRow label="Орендар" name={data.terms.renter.name} signature={data.signatures.renter} you={role === 'renter'} />

      {canSign ? (
        <>
          <Card style={{ backgroundColor: theme.positiveSoft }}>
            <ThemedText type="smallBold" themeColor="positive">
              Час підписати договір
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Підписуйте, коли зустрінетесь: власник передає авто й ключі, орендар — гроші. Кожна сторона підписує зі свого телефону.
            </ThemedText>
          </Card>
          <Button title="Підписати договір" icon="create-outline" disabled={busy !== null} onPress={confirmSign} />
        </>
      ) : awaiting && !data.mySigned ? (
        <Card style={{ backgroundColor: theme.warningSoft }}>
          <ThemedText type="smallBold" themeColor="warning">
            {state === 'early' ? `Підписання відкриється ${formatDate(data.signing.opensAt)}` : 'Час на підписання минув'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {state === 'early'
              ? 'Спершу уважно прочитайте договір. Підписувати його потрібно під час зустрічі, коли ви передаєте авто, ключі й гроші, за добу до початку оренди й пізніше.'
              : 'Договір не підписано вчасно, тому домовленість буде скасовано. Домовтесь про нову оренду.'}
          </ThemedText>
        </Card>
      ) : awaiting ? (
        <Card style={{ backgroundColor: theme.warningSoft }}>
          <ThemedText type="smallBold" themeColor="warning">
            Ви підписали. Чекаємо підпису другої сторони
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Оренда почнеться, коли договір підпишуть обидві сторони.
          </ThemedText>
        </Card>
      ) : null}

      <Button title="Завантажити PDF" icon="download-outline" variant="secondary" disabled={busy === 'pdf'} onPress={() => void pdf()} />

      {data.sections.map((s) => (
        <Card key={s.title}>
          <ThemedText type="default" style={styles.bold}>
            {s.title}
          </ThemedText>
          {s.paragraphs.map((p, i) => (
            <ThemedText key={i} type="small" themeColor={p.startsWith('Договір сформовано застосунком') ? 'textSecondary' : 'text'} style={styles.paragraph}>
              {p}
            </ThemedText>
          ))}
        </Card>
      ))}

      <ThemedText type="small" themeColor="textSecondary" style={styles.hash} selectable>
        Відбиток умов договору (SHA-256): {data.hash}
      </ThemedText>

      {awaiting ? <Button title="Скасувати домовленість" variant="danger" disabled={busy !== null} onPress={confirmCancel} /> : null}
    </Screen>
  );
}

function SignatureRow({ label, name, signature, you }: { label: string; name: string; signature: ContractSignature; you: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.sign, { backgroundColor: signature ? theme.positiveSoft : theme.backgroundElement, borderColor: signature ? theme.positive : theme.borderStrong }]}>
      <Icon name={signature ? 'checkmark-circle' : 'time-outline'} size={26} color={signature ? 'positive' : 'textSecondary'} />
      <View style={styles.flex}>
        <ThemedText type="default" style={styles.bold}>
          {label}: {name}
          {you ? ' (ви)' : ''}
        </ThemedText>
        {signature ? (
          <>
            <ThemedText type="small" themeColor="positive">
              Підписано {formatDate(signature.at.slice(0, 10))} {signature.at.slice(11, 16)} UTC
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {METHOD_LABEL(signature.method)} · ID {signature.signatureId}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Очікує підпису
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  paragraph: { lineHeight: 20 },
  sign: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  hash: { fontSize: 11 },
});
