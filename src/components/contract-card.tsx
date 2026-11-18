import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
    const agreed = !!deal.condition?.ready && !!deal.condition?.confirmed;
    const ready = c.signing.state === 'open' && !c.mySigned && agreed;
    const stateAction = c.signing.state === 'open' && !c.mySigned && !agreed ? stateButton(as, deal.condition) : null;
    const steps: Step[] = [
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

type Step = { title: string; text: string; done: boolean; onPress?: () => void };

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
  return { title: 'Стан авто', text, done, onPress };
}

/** Дія, якої від цієї сторони чекає стан авто: власнику зробити фото, орендарю підтвердити; інакше нічого */
function stateButton(as: 'owner' | 'renter', c: DealView['condition'] | undefined): { title: string; icon: 'camera-outline' | 'checkmark-circle-outline' } | null {
  if (!c) return null;
  if (as === 'owner' && !c.ready) return { title: 'Зробити фото стану авто', icon: 'camera-outline' };
  if (as === 'renter' && c.ready && !c.confirmed) return { title: 'Переглянути й підтвердити стан авто', icon: 'checkmark-circle-outline' };
  return null;
}

/** Чек-лист кроків до початку оренди: пронумеровані кроки, виконані з галочкою, натискні ведуть до дії */
function Steps({ title, steps }: { title: string; steps: Step[] }) {
  const theme = useTheme();
  const doneCount = steps.filter((s) => s.done).length;
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
      {steps.map((st, i) => {
        const body = (
          <View style={styles.step}>
            <View style={[styles.dot, { backgroundColor: st.done ? theme.positive : theme.accentSoft }]}>
              {st.done ? <Icon name="checkmark" size={16} color={theme.onInk} /> : <ThemedText type="caption" themeColor="accent" style={styles.dotText}>{i + 1}</ThemedText>}
            </View>
            <View style={styles.text}>
              <ThemedText type="body" style={styles.stepTitle}>
                {st.title}
              </ThemedText>
              <ThemedText type="callout" themeColor={st.done ? 'positive' : 'textSecondary'}>
                {st.text}
              </ThemedText>
            </View>
            {st.onPress ? <Icon name="chevron-forward" size={18} color="textSecondary" /> : null}
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
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  iconBox: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 0 },
  flow: { gap: Spacing.three },
  steps: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  stepsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  stepsTitle: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52, paddingVertical: Spacing.one },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontWeight: 700 },
  stepTitle: { fontWeight: 600 },
});
