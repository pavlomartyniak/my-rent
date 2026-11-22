import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { BottomSheet } from './ui/bottom-sheet';
import { Button } from './ui/button';

export type StatInfo = {
  title: string;
  /** Число, яке бачить користувач у картці */
  value: string;
  tone?: 'positive' | 'negative';
  /** Пояснення простими словами: короткі абзаци */
  explain: string[];
  /** Рядки «звідки це число»: підпис і значення */
  rows?: { label: string; value: string; tone?: 'positive' | 'negative' }[];
  /** Приклад чи підсумок наприкінці, одним реченням */
  example?: string;
  extra?: ReactNode;
};

/** Нижній лист-пояснення показника: що це, звідки число і що з ним робити. Мова проста, без термінів, щоб зрозумів кожен */
export function StatInfoSheet({ info, onClose }: { info: StatInfo | null; onClose: () => void }) {
  const theme = useTheme();
  return (
    <BottomSheet visible={!!info} onClose={onClose}>
      {info ? (
        <>
          <ThemedText type="title" accessibilityRole="header">
            {info.title}
          </ThemedText>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={[styles.value, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="caption" themeColor="textSecondary">
                Зараз у вас
              </ThemedText>
              <ThemedText style={styles.big} themeColor={info.tone}>
                {info.value}
              </ThemedText>
            </View>

            {info.explain.map((t, i) => (
              <ThemedText key={i} type="body">
                {t}
              </ThemedText>
            ))}

            {info.rows?.length ? (
              <View style={[styles.rows, { borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Звідки це число
                </ThemedText>
                {info.rows.map((r) => (
                  <View key={r.label} style={styles.row}>
                    <ThemedText type="callout" style={styles.flex}>
                      {r.label}
                    </ThemedText>
                    <ThemedText type="callout" themeColor={r.tone} style={styles.bold}>
                      {r.value}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {info.example ? (
              <View style={[styles.example, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="callout">{info.example}</ThemedText>
              </View>
            ) : null}
            {info.extra}
          </ScrollView>
          <Button title="Зрозуміло" onPress={onClose} />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, paddingBottom: Spacing.two },
  value: { padding: Spacing.three, borderRadius: Radius.md, gap: 2 },
  big: { ...Type.figure },
  rows: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: 600 },
  example: { padding: Spacing.three, borderRadius: Radius.md },
});
