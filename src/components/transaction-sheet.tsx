import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import type { TransactionType } from '@/types';

import { type SavedTx, TransactionFields } from './transaction-form';
import { ThemedText } from './themed-text';
import { BottomSheet } from './ui/bottom-sheet';
import { Icon } from './ui/icon';

type Request = { type?: TransactionType; carId?: string; dealId?: string };
type Ctx = { open: (request?: Request) => void };

const SheetContext = createContext<Ctx | null>(null);

/** Додати дохід чи витрату з будь-якого екрана: відкривається нижній лист на місці, тип, авто й оренда підставляються з контексту */
export function useAddTransaction() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useAddTransaction має бути всередині TransactionSheetProvider');
  return ctx.open;
}

/**
 * Єдине місце додавання запису: нижній лист із формою, а після збереження коротке підтвердження «Записано · Переглянути»,
 * яке веде до записів за цей тип (і за це авто чи оренду). Користувач лишається там, де був.
 */
export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [saved, setSaved] = useState<SavedTx | null>(null);
  const open = useCallback((r?: Request) => {
    setSaved(null);
    setRequest(r ?? {});
  }, []);
  const hide = useCallback(() => setSaved(null), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <SheetContext.Provider value={value}>
      {children}
      {request ? (
        <AddSheet
          request={request}
          onClose={() => setRequest(null)}
          onSaved={(s) => {
            setRequest(null);
            setSaved(s);
            haptic.success();
          }}
        />
      ) : null}
      {saved ? <SavedToast saved={saved} onHide={hide} /> : null}
    </SheetContext.Provider>
  );
}

function AddSheet({ request, onClose, onSaved }: { request: Request; onClose: () => void; onSaved: (s: SavedTx) => void }) {
  return (
    <BottomSheet visible onClose={onClose}>
      <ThemedText type="title" accessibilityRole="header">
        Новий запис
      </ThemedText>
      <ScrollView contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TransactionFields embedded initialCarId={request.carId} dealId={request.dealId} initialType={request.type} onDone={onSaved} />
      </ScrollView>
    </BottomSheet>
  );
}

function SavedToast({ saved, onHide }: { saved: SavedTx; onHide: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    timer.current = setTimeout(onHide, 5000);
    return () => clearTimeout(timer.current);
  }, [onHide]);

  function view() {
    onHide();
    router.push({ pathname: '/transactions', params: { type: saved.type, ...(saved.carId ? { carId: saved.carId } : {}), ...(saved.dealId ? { dealId: saved.dealId } : {}) } });
  }

  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + 84 }]}>
      <View style={[styles.toast, { backgroundColor: theme.ink }]} accessibilityLiveRegion="polite">
        <Icon name="checkmark-circle" size={20} color={theme.onInk} />
        <ThemedText type="callout" style={[styles.toastText, { color: theme.onInk }]}>
          {saved.type === 'income' ? 'Дохід записано' : 'Витрату записано'}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Переглянути записи" onPress={view} hitSlop={8} style={styles.toastAction}>
          <ThemedText type="smallBold" style={{ color: theme.onInk, textDecorationLine: 'underline' }}>
            Переглянути
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: Spacing.three, paddingBottom: Spacing.two },
  toastWrap: { position: 'absolute', left: Spacing.three, right: Spacing.three, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 12, paddingHorizontal: Spacing.three, borderRadius: Radius.md, maxWidth: 480 },
  toastText: { flexShrink: 1, fontWeight: 600 },
  toastAction: { minHeight: 32, justifyContent: 'center', paddingLeft: Spacing.two },
});
