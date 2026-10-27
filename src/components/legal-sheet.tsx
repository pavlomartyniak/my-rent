import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LEGAL, LEGAL_UPDATED } from '@/lib/legal';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Політика конфіденційності чи умови користування у вигляді вікна на весь екран. Це не окремий маршрут:
 * вікно відкривається і до входу, і після нього, не впливаючи на навігацію застосунку.
 */
export function LegalSheet({ doc, onClose }: { doc: 'privacy' | 'terms' | null; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const d = doc ? LEGAL[doc] : null;

  return (
    <Modal visible={!!d} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <ThemedText type="default" style={styles.title} numberOfLines={1}>
            {d?.title}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрити" onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={24} color="text" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Оновлено {LEGAL_UPDATED}
          </ThemedText>
          {d?.sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <ThemedText type="default" style={styles.sectionTitle}>
                {s.title}
              </ThemedText>
              {s.paragraphs.map((p) => (
                <ThemedText key={p} type="default">
                  {p}
                </ThemedText>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.three, paddingHorizontal: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontWeight: 600, textAlign: 'center' },
  close: { position: 'absolute', right: Spacing.three, top: Spacing.three },
  content: { padding: 20, gap: Spacing.three },
  section: { gap: Spacing.two },
  sectionTitle: { fontWeight: 700, fontSize: 18 },
});
