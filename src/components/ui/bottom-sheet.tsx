'use no memo';

import { Children, Fragment, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Йде запит: тап по фону, свайп і «назад» не закривають лист */
  locked?: boolean;
  children: ReactNode;
};

const OFFSCREEN = 720;

/** Розгортає фрагменти, щоб знайти перший елемент листа (зазвичай заголовок) */
function flatten(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((c) => (isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment ? flatten(c.props.children) : [c]));
}

type Shared = ReturnType<typeof useSharedValue<number>>;
const slide = (v: Shared, to: number, ms: number, easing: (t: number) => number, done?: () => void) => {
  v.value = withTiming(to, { duration: ms, easing }, (finished) => {
    if (finished && done) runOnJS(done)();
  });
};
const setNow = (v: Shared, to: number) => {
  v.value = to;
};
const springBack = (v: Shared) => {
  v.value = withSpring(0, { damping: 22, stiffness: 260 });
};

/** Свайп вниз за ручку: лист іде за пальцем, відпустили далеко чи швидко — закриваємо, інакше повертаємо */
function makePan(y: Shared, getClose: () => (() => void) | undefined) {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderMove: (_, g) => setNow(y, g.dy > 0 ? g.dy : g.dy / 6),
    onPanResponderRelease: (_, g) => {
      const close = getClose();
      if (close && (g.dy > 90 || g.vy > 0.9)) close();
      else springBack(y);
    },
    onPanResponderTerminate: () => springBack(y),
  });
}

/**
 * Єдиний нижній лист для підтверджень, форм і дій: ручка зверху, затемнений фон, плавна поява й зникання
 * (без анімації при «Зменшити рух»). Закривається тапом по фону, системним «назад» і свайпом вниз за ручку
 * чи верхню частину листа.
 */
export function BottomSheet({ visible, onClose, locked, children }: Props) {
  const close = locked ? undefined : onClose;
  // Модальне вікно лишається змонтованим, поки грає анімація зникання
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Sheet visible={visible} onClose={close} onExited={() => setMounted(false)}>
        {children}
      </Sheet>
    </Modal>
  );
}

function Sheet({ visible, onClose, onExited, children }: { visible: boolean; onClose?: () => void; onExited: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(OFFSCREEN);
  const dim = useSharedValue(0);
  const reduce = useRef(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    let off = false;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (off) return;
      reduce.current = r;
      if (visible) {
        slide(y, 0, r ? 0 : 260, Easing.out(Easing.cubic));
        slide(dim, 1, r ? 0 : 220, Easing.linear);
      }
    });
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Зникання: лист з'їжджає вниз, фон світлішає, лише потім модальне вікно знімається
  useEffect(() => {
    if (visible) return;
    slide(dim, 0, reduce.current ? 0 : 200, Easing.linear);
    slide(y, OFFSCREEN, reduce.current ? 0 : 240, Easing.in(Easing.cubic), onExited);
  }, [visible, y, dim, onExited]);

  // Обробник читає актуальний onClose з ref лише під час жесту, а не під час рендеру
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => makePan(y, () => closeRef.current));

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  const [first, ...rest] = flatten(children);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <Animated.View style={[styles.backdrop, dimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрити" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.sheet, { backgroundColor: theme.backgroundElement, paddingBottom: Math.max(insets.bottom, Spacing.three) }, sheetStyle]}>
        {/* Свайп вниз працює від ручки й заголовка (перший елемент листа): решта вмісту може прокручуватись */}
        <View {...pan.panHandlers} style={styles.grab}>
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} accessibilityElementsHidden importantForAccessibility="no" />
          {first}
        </View>
        {rest}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingHorizontal: Spacing.three, gap: Spacing.three, maxHeight: '92%' },
  // Зона захоплення ширша за саму ручку: за неї зручно тягнути
  grab: { alignSelf: 'stretch', gap: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.one, paddingHorizontal: Spacing.three, marginHorizontal: -Spacing.three },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
