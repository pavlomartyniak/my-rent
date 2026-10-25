import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { EXPORT_FORMATS, exportFile, type ExportFilter, type ExportFormat } from '@/lib/export';

import { ThemedText } from './themed-text';
import { Button } from './ui/button';
import { Icon } from './ui/icon';

/** Нижній лист вибору формату експорту (Excel, PDF, CSV) */
export function ExportSheet({ visible, onClose, filter, subtitle }: { visible: boolean; onClose: () => void; filter?: ExportFilter; subtitle?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    setBusy(format);
    try {
      await exportFile(format, filter);
      onClose();
    } catch (e) {
      Alert.alert('Не вдалося експортувати', e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Спробуйте ще раз');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <ThemedText type="default" style={styles.heading}>
            Експорт обліку
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
          {EXPORT_FORMATS.map((f, i) => (
            <Pressable
              key={f.format}
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => void run(f.format)}
              style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="default" style={styles.title}>
                  {f.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {f.hint}
                </ThemedText>
              </View>
              {busy === f.format ? <ActivityIndicator /> : <Icon name="download-outline" size={22} color="accent" />}
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

/** Кнопка «Експорт», що відкриває лист вибору формату для заданої вибірки */
export function ExportButton({ filter, subtitle, title = 'Експорт' }: { filter?: ExportFilter; subtitle?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button title={title} icon="download-outline" variant="secondary" onPress={() => setOpen(true)} />
      <ExportSheet visible={open} onClose={() => setOpen(false)} filter={filter} subtitle={subtitle} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: 2 },
  heading: { fontWeight: 700, fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  title: { fontWeight: 600 },
});
