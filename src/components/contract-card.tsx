import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/date';
import type { DealView } from '@/lib/deals';
import { dealStage } from '@/lib/deals';
import { useFleet } from '@/store/fleet';

import { AckSheet } from './ack-sheet';
import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/**
 * Стан договору в оренді: чекаємо підпису (кнопка «Підписати»), чекаємо другу сторону чи вже підписано.
 * Оренда починається лише після підписів обох сторін.
 */
export function ContractCard({ deal, as }: { deal: Pick<DealView, 'id' | 'status' | 'contract' | 'startDate' | 'endDate' | 'condition'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  const { invalidate } = useFleet();
  const [acking, setAcking] = useState(false);
  const c = deal.contract;
  if (!c) return null;

  const awaiting = deal.status === 'awaiting';
  const other = as === 'owner' ? 'орендар' : 'власник';
  const open = () => router.push({ pathname: '/contracts/[id]', params: { id: deal.id } });

  // Оренда без договору: тексту договору немає, сторони підтверджують умови в застосунку (без коду з пошти)
  if (c.mode === 'none') {
    if (awaiting) {
      const agreed = !!deal.condition?.ready && !!deal.condition?.confirmed;
      const ready = c.signing.state === 'open' && !c.mySigned && agreed;
      const stateAction = c.signing.state === 'open' && !c.mySigned && !agreed ? stateButton(as, deal.condition) : null;
      const steps: Step[] = [
        ...(deal.condition ? [conditionStep(deal.condition, as, () => router.push({ pathname: '/condition/[id]', params: { id: deal.id } }))] : []),
        {
          title: 'Підтвердження умов',
          text: c.mySigned ? `Ви підтвердили. Чекаємо: ${other}` : c.signing.state === 'open' ? 'Підтверджуйте під час зустрічі, коли передаєте авто, ключі й гроші' : `Відкриється ${formatDate(c.signing.opensAt)}, під час зустрічі`,
          done: c.mySigned,
        },
      ];
      return (
        <View style={styles.flow}>
          <Steps title="Щоб почати оренду без договору" steps={steps} />
          {ready ? <Button title="Підтвердити умови" icon="checkmark-circle-outline" onPress={() => setAcking(true)} /> : null}
          {stateAction ? <Button title={stateAction.title} icon={stateAction.icon} onPress={() => router.push({ pathname: '/condition/[id]', params: { id: deal.id } })} /> : null}
          <CancelAgreement dealId={deal.id} />
          <AckSheet
            dealId={deal.id}
            visible={acking}
            onClose={() => setAcking(false)}
            onDone={() => {
              setAcking(false);
              invalidate();
            }}
          />
        </View>
      );
    }
    const done = deal.status !== 'terminated';
    return (
      <View style={[styles.panel, { backgroundColor: done ? theme.positiveSoft : theme.backgroundSelected }]}>
        <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="document-outline" size={20} color={done ? 'positive' : 'textSecondary'} />
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold" themeColor={done ? 'positive' : 'textSecondary'}>
            Оренда без договору
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {done ? 'Умови підтвердили обидві сторони. Розірвати можна лише за згодою.' : 'Оренда завершена'}
          </ThemedText>
        </View>
      </View>
    );
  }

  if (awaiting) {
    const legal = c.legal ?? { mine: true, other: true };
    const agreed = !!deal.condition?.ready && !!deal.condition?.confirmed;
    const ready = c.signing.state === 'open' && !c.mySigned && agreed && legal.mine && legal.other;
    const stateAction = c.signing.state === 'open' && !c.mySigned && !agreed ? stateButton(as, deal.condition) : null;
    const steps: Step[] = [
      legalStep(legal, other, () => router.push('/legal')),
      ...(deal.condition ? [conditionStep(deal.condition, as, () => router.push({ pathname: '/condition/[id]', params: { id: deal.id } }))] : []),
      { title: 'Договір', text: `№ ${c.number}. Перегляньте його зараз`, done: false, onPress: open },
      {
        title: 'Підписання',
        text: c.mySigned ? `Ви підписали. Чекаємо підпису: ${other}` : c.signing.state === 'open' ? 'Підписуйте під час зустрічі, коли передаєте авто, ключі й гроші' : `Відкриється ${formatDate(c.signing.opensAt)}, під час зустрічі`,
        done: c.mySigned,
      },
    ];
    return (
      <View style={styles.flow}>
        <Steps title="Щоб почати оренду" steps={steps} />
        {stateAction ? <Button title={stateAction.title} icon={stateAction.icon} onPress={() => router.push({ pathname: '/condition/[id]', params: { id: deal.id } })} /> : null}
        <Button title={ready ? 'Переглянути й підписати' : 'Переглянути договір'} icon="document-text-outline" variant={ready ? 'primary' : 'secondary'} onPress={open} />
        <CancelAgreement dealId={deal.id} />
      </View>
    );
  }

  const terminated = deal.status === 'terminated';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Переглянути договір" onPress={open}>
      <View style={[styles.panel, { backgroundColor: terminated ? theme.backgroundSelected : theme.positiveSoft }]}>
        <View style={[styles.iconBox, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="document-text-outline" size={20} color={terminated ? 'textSecondary' : 'positive'} />
        </View>
        <View style={styles.text}>
          <ThemedText type="smallBold" themeColor={terminated ? 'textSecondary' : 'positive'}>
            {terminated ? 'Договір' : 'Договір підписано обома сторонами'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            № {c.number}
            {dealStage(deal) === 'upcoming' ? ' · оренда почнеться в день початку' : ' · Переглянути'}
          </ThemedText>
        </View>
        <Icon name="chevron-forward" size={18} color="textSecondary" />
      </View>
    </Pressable>
  );
}

/** Вихід з угоди до підписання: спокійна кнопка під кроками. Після підписання її немає: далі лише розірвання за згодою */
function CancelAgreement({ dealId }: { dealId: string }) {
  const theme = useTheme();
  const { invalidate } = useFleet();
  const [busy, setBusy] = useState(false);

  const confirm = () =>
    Alert.alert('Скасувати домовленість?', 'Договір не буде підписано, авто знову стане вільним, а друга сторона побачить скасування.', [
      { text: 'Залишити', style: 'cancel' },
      {
        text: 'Скасувати домовленість',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api('POST', `/deals/${dealId}/cancel-agreement`, {});
          } catch (e) {
            Alert.alert('Не вдалося скасувати', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
          } finally {
            setBusy(false);
            invalidate();
          }
        },
      },
    ]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Скасувати домовленість" disabled={busy} onPress={confirm} style={[styles.cancel, busy && { opacity: 0.5 }]} hitSlop={8}>
      <ThemedText type="callout" style={{ color: theme.negative, fontWeight: 600 }}>
        Скасувати домовленість
      </ThemedText>
    </Pressable>
  );
}

/** waiting — крок чекає на другу сторону: від користувача зараз нічого не потрібно */
type Step = { title: string; text: string; done: boolean; onPress?: () => void; waiting?: boolean };

/** Крок «Дані для договору»: кожна сторона один раз заповнює документ і адресу, щоб у договорі не було порожніх рядків */
function legalStep(l: { mine: boolean; other: boolean }, other: string, onPress: () => void): Step {
  if (!l.mine) return { title: 'Дані для договору', text: 'Документ, РНОКПП, адреса: 2 хвилини, один раз. Без них договір не підписати', done: false, onPress };
  if (!l.other) return { title: 'Дані для договору', text: `Ви заповнили. Чекаємо дані: ${other}`, done: false, onPress, waiting: true };
  return { title: 'Дані для договору', text: 'Заповнено обома сторонами', done: true, onPress };
}

/** Крок «Стан авто» чек-листа: власник фіксує фото й одометр, орендар переглядає й підтверджує */
function conditionStep(c: NonNullable<DealView['condition']>, as: 'owner' | 'renter', onPress: () => void): Step {
  const done = c.ready && c.confirmed;
  const text =
    as === 'owner'
      ? done
        ? 'Зафіксовано, орендар підтвердив'
        : c.ready
          ? 'Фото зроблено. Чекаємо, поки орендар підтвердить'
          : `Обов’язкові фото: ${c.have} з ${c.need}. Без цього оренду не почати`
      : done
        ? 'Ви погодились зі станом авто'
        : c.ready
          ? 'Перегляньте фото власника й підтвердьте стан'
          : `Власник фіксує стан авто: ${c.have} з ${c.need}`;
  const waiting = !done && (as === 'owner' ? c.ready : !c.ready);
  return { title: 'Стан авто', text, done, onPress, waiting };
}

/** Дія, якої від цієї сторони чекає стан авто: власнику зробити фото, орендарю підтвердити; інакше нічого */
function stateButton(as: 'owner' | 'renter', c: DealView['condition'] | undefined): { title: string; icon: 'camera-outline' | 'checkmark-circle-outline' } | null {
  if (!c) return null;
  if (as === 'owner' && !c.ready) return { title: 'Зробити фото стану авто', icon: 'camera-outline' };
  if (as === 'renter' && c.ready && !c.confirmed) return { title: 'Підтвердити стан авто', icon: 'checkmark-circle-outline' };
  return null;
}

/** Чек-лист кроків до початку оренди: пронумеровані кроки, виконані з галочкою, натискні ведуть до дії */
function Steps({ title, steps }: { title: string; steps: Step[] }) {
  const theme = useTheme();
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((x) => !x.done);
  return (
    <View style={[styles.steps, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.stepsHead}>
        <ThemedText type="headline" style={styles.stepsTitle}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {doneCount} з {steps.length}
        </ThemedText>
      </View>
      {/* Прогрес сегментами: пройдені зелені, поточний фіолетовий */}
      <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no">
        {steps.map((st, i) => (
          <View key={st.title} style={[styles.segment, { backgroundColor: st.done ? theme.positive : i === currentIndex ? theme.accent : theme.border }]} />
        ))}
      </View>
      {/* Стрічка кроків: вертикальна лінія з'єднує кола, поточний крок має ореол, наступні приглушені */}
      <View>
        {steps.map((st, i) => {
          const current = i === currentIndex;
          const upcoming = !st.done && !current;
          const last = i === steps.length - 1;
          const body = (
            <View style={[styles.step, upcoming && styles.stepUpcoming]}>
              <View style={styles.rail}>
                <View style={styles.dotWrap}>
                  {current && !st.waiting ? <View style={[styles.halo, { backgroundColor: theme.accentSoft }]} /> : null}
                  <View
                    style={[
                      styles.dot,
                      st.done
                        ? { backgroundColor: theme.positive }
                        : current && !st.waiting
                          ? { backgroundColor: theme.accent }
                          : current
                            ? { borderWidth: 2, borderColor: theme.accent, backgroundColor: theme.backgroundElement }
                            : { backgroundColor: theme.backgroundSelected },
                    ]}>
                    {st.done ? (
                      <Icon name="checkmark" size={16} color={theme.onInk} />
                    ) : current && st.waiting ? (
                      <Icon name="time-outline" size={16} color="accent" />
                    ) : (
                      <ThemedText type="caption" style={[styles.dotText, { color: current ? theme.onAccent : theme.textSecondary }]}>
                        {i + 1}
                      </ThemedText>
                    )}
                  </View>
                </View>
                {!last ? <View style={[styles.line, { backgroundColor: st.done ? theme.positive : theme.border }]} /> : null}
              </View>
              <View style={[styles.text, !last && styles.textGap]}>
                <View style={styles.titleRow}>
                  <ThemedText type="body" style={[styles.stepTitle, current && styles.stepTitleCurrent]}>
                    {st.title}
                  </ThemedText>
                  {current ? (
                    <View style={[styles.pill, { backgroundColor: st.waiting ? theme.backgroundSelected : theme.accentSoft }]}>
                      <ThemedText type="caption" themeColor={st.waiting ? 'textSecondary' : 'accent'} style={styles.pillText}>
                        {st.waiting ? 'Очікуємо' : 'Зараз'}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="callout" themeColor={st.done ? 'positive' : current && !st.waiting ? 'text' : 'textSecondary'}>
                  {st.text}
                </ThemedText>
              </View>
              {st.onPress ? (
                <View style={styles.chevron}>
                  <Icon name="chevron-forward" size={18} color="textSecondary" />
                </View>
              ) : null}
            </View>
          );
          return st.onPress ? (
            <Pressable key={st.title} accessibilityRole="button" accessibilityLabel={`${st.title}. ${st.text}`} onPress={st.onPress}>
              {body}
            </Pressable>
          ) : (
            <View key={st.title}>{body}</View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  iconBox: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 0 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  flow: { gap: Spacing.three },
  steps: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three },
  stepsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  stepsTitle: { flex: 1 },
  progress: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  step: { flexDirection: 'row', gap: Spacing.three },
  stepUpcoming: { opacity: 0.55 },
  rail: { width: 36, alignItems: 'center' },
  dotWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 36, height: 36, borderRadius: 18 },
  line: { flex: 1, width: 2, borderRadius: 1, marginVertical: 2 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontWeight: 700 },
  textGap: { paddingBottom: Spacing.three },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 36 },
  pill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.pill },
  pillText: { fontWeight: 700 },
  chevron: { alignSelf: 'flex-start', marginTop: 9 },
  stepTitleCurrent: { fontWeight: 700 },
  stepTitle: { fontWeight: 600 },
});
