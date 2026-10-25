import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { type AttentionItem, useAttention } from '@/hooks/use-attention';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * «Потрібна ваша увага»: єдине місце на головній для всього, що чекає на користувача.
 * Замість окремих кольорових банерів — один список рядків, кожен веде до потрібного екрана.
 */
export function AttentionList({ role }: { role: 'owner' | 'renter' }) {
  const router = useRouter();
  const theme = useTheme();
  const { invalidate, reload } = useFleet();
  const { items, urgent } = useAttention(role);
  const [busy, setBusy] = useState(false);

  if (items.length === 0) return null;

  async function release(dealId: string, action: 'release' | 'keep') {
    setBusy(true);
    try {
      await api('POST', `/deals/${dealId}/${action}`);
      if (action === 'release') reload();
      invalidate();
    } catch (e) {
      Alert.alert('Не вдалося виконати дію', e instanceof ApiError ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(false);
    }
  }

  function open(item: AttentionItem) {
    const t = item.target;
    if (t.kind === 'contract') router.push({ pathname: '/contracts/[id]', params: { id: t.dealId } });
    else if (t.kind === 'deal') router.push({ pathname: '/deals/[id]', params: { id: t.dealId } });
    else if (t.kind === 'car') router.push({ pathname: '/car/[id]', params: { id: t.carId } });
    else if (t.kind === 'tab') router.navigate(t.params ? { pathname: t.href as '/requests', params: t.params } : (t.href as '/requests'));
    else {
      Alert.alert('Оренда закінчилась', `${t.deal.title}: авто досі «В оренді». Звільнити його?`, [
        { text: 'Оренда триває', onPress: () => void release(t.deal.id, 'keep') },
        { text: 'Звільнити авто', onPress: () => void release(t.deal.id, 'release') },
      ]);
    }
  }

  // Колір рядка показує, наскільки це термінове: зелений — підписати договір, синій — відповісти, жовтий — нагадати
  const palette = (tone: AttentionItem['tone']) =>
    tone === 'success'
      ? { solid: theme.positive, soft: theme.positiveSoft }
      : tone === 'urgent'
        ? { solid: theme.accent, soft: theme.accentSoft }
        : tone === 'warning'
          ? { solid: theme.warning, soft: theme.warningSoft }
          : { solid: theme.textSecondary, soft: theme.backgroundSelected };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <ThemedText type="default" style={styles.headerTitle}>
          Потрібна ваша увага
        </ThemedText>
        {urgent > 0 ? (
          <View style={[styles.count, { backgroundColor: theme.negative }]}>
            <ThemedText style={styles.countText}>{urgent}</ThemedText>
          </View>
        ) : null}
      </View>
      {items.map((item) => {
        const c = palette(item.tone);
        const loud = item.tone !== 'info';
        return (
          <Pressable key={item.key} accessibilityRole="button" disabled={busy} onPress={() => open(item)} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            <View style={[styles.row, { backgroundColor: c.soft, borderColor: loud ? c.solid : theme.border, borderWidth: loud ? 1.5 : 1 }]}>
              <View style={[styles.icon, { backgroundColor: c.solid }]}>
                <Icon name={item.icon} size={22} color="#FFFFFF" />
              </View>
              <View style={styles.flex}>
                <ThemedText type="default" style={styles.title} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {item.text}
                </ThemedText>
              </View>
              <View style={[styles.pill, { backgroundColor: c.solid }]}>
                <ThemedText type="smallBold" style={styles.pillText}>
                  {item.action}
                </ThemedText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerTitle: { fontWeight: 700, fontSize: 18 },
  count: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  icon: { width: 42, height: 42, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { fontWeight: 700 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: 8, borderRadius: Radius.pill },
  pillText: { color: '#FFFFFF' },
});
