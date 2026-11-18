import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Йде запит: тап по фону й «назад» не закривають лист */
  locked?: boolean;
  children: ReactNode;
};

/**
 * Єдиний нижній лист для підтверджень, форм і дій: ручка зверху, затемнений фон, плавна поява
 * (без анімації при «Зменшити рух»), закриття тапом по фону чи системним «назад».
 */
export function BottomSheet({ visible, onClose, locked, children }: Props) {
  const close = locked ? undefined : onClose;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Sheet onClose={close}>{children}</Sheet>
    </Modal>
  );
}

function Sheet({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(48);

  useEffect(() => {
    let off = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!off) y.value = reduce ? 0 : withTiming(0, { duration: 220 });
    });
    return () => {
      off = true;
    };
  }, [y]);

  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрити" onPress={onClose} style={styles.backdrop} />
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }, animated]}>
        <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.three, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.one },
});
