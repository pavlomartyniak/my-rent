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
import { ConditionCard } from './condition-card';
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
      const ready = c.signing.state === 'open' && !c.mySigned && !!deal.condition?.ready;
      return (
        <View style={[styles.box, { backgroundColor: ready ? theme.positiveSoft : theme.accentSoft }]}>
          <ThemedText type="smallBold" themeColor={ready ? 'positive' : 'accent'}>
            {c.mySigned ? `Ви підтвердили умови. Чекаємо: ${other}` : ready ? 'Підтвердіть оренду без договору' : 'Оренда без договору'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {c.mySigned
              ? 'Оренда почнеться, коли умови підтвердять обидві сторони.'
              : ready
                ? 'Підтверджуйте під час зустрічі, коли передаєте авто, ключі й гроші. Договір не складається: Kolo лише веде облік платежів, застави й чату.'
                : `Договір не складається: Kolo лише веде облік. Підтвердження відкриється ${formatDate(c.signing.opensAt)}, під час зустрічі.`}
          </ThemedText>
          {c.signing.state === 'open' && !c.mySigned && !deal.condition?.ready ? <ConditionCard deal={deal} /> : null}
          {ready ? <Button title="Підтвердити умови" icon="checkmark-circle-outline" onPress={() => setAcking(true)} /> : null}
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
    const ready = c.signing.state === 'open' && !c.mySigned && !!deal.condition?.ready;
    return (
      <View style={[styles.box, ready ? { backgroundColor: theme.positiveSoft, borderColor: 'transparent' } : { backgroundColor: theme.accentSoft, borderColor: 'transparent' }]}>
        <ThemedText type="smallBold" themeColor={ready ? 'positive' : 'accent'}>
          {c.mySigned ? `Ви підписали. Чекаємо підпису: ${other}` : ready ? 'Час підписати договір' : 'Договір сформовано'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {c.mySigned
            ? `Договір № ${c.number}. Оренда почнеться, коли його підпишуть обидві сторони.`
            : ready
              ? `Договір № ${c.number}. Підписуйте його під час зустрічі, коли передаєте авто, ключі й гроші.`
              : `Договір № ${c.number}. Перегляньте його зараз, а підписуйте під час зустрічі: підписання відкриється ${formatDate(c.signing.opensAt)}.`}
        </ThemedText>
        {c.signing.state === 'open' && !c.mySigned && !deal.condition?.ready ? <ConditionCard deal={deal} /> : null}
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

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  iconBox: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 0 },
});
