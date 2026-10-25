import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DealView } from '@/lib/deals';
import { dealStage } from '@/lib/deals';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';

/**
 * Стан договору в оренді: чекаємо підпису (кнопка «Підписати»), чекаємо другу сторону чи вже підписано.
 * Оренда починається лише після підписів обох сторін.
 */
export function ContractCard({ deal, as }: { deal: Pick<DealView, 'id' | 'status' | 'contract' | 'startDate' | 'endDate'>; as: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  const c = deal.contract;
  if (!c) return null;

  const awaiting = deal.status === 'awaiting';
  const other = as === 'owner' ? 'орендар' : 'власник';
  const open = () => router.push({ pathname: '/contracts/[id]', params: { id: deal.id } });

  if (awaiting) {
    return (
      <View style={[styles.box, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
        <ThemedText type="smallBold" themeColor="warning">
          {c.mySigned ? `Чекаємо підпису: ${other}` : 'Договір чекає вашого підпису'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Договір № {c.number}. Оренда почнеться, коли його підпишуть обидві сторони.
        </ThemedText>
        <Button title={c.mySigned ? 'Переглянути договір' : 'Переглянути й підписати'} icon="document-text-outline" variant={c.mySigned ? 'secondary' : 'primary'} onPress={open} />
      </View>
    );
  }

  return (
    <View style={[styles.box, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor={deal.status === 'terminated' ? 'textSecondary' : 'positive'}>
        {deal.status === 'terminated' ? 'Договір' : '✓ Договір підписано обома сторонами'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        № {c.number}
        {dealStage(deal) === 'upcoming' ? ' · оренда почнеться в день початку' : ''}
      </ThemedText>
      <Button title="Переглянути договір" icon="document-text-outline" variant="secondary" onPress={open} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
});
