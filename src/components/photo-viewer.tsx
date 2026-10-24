import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Animated, FlatList, Modal, PanResponder, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { thumbnailUrl } from '@/lib/media';

import { ThemedText } from './themed-text';
import { IconButton } from './ui/icon-button';

type Props = {
  photos: string[];
  /** Фото, з якого починаємо перегляд */
  startIndex?: number;
  onClose: () => void;
};

/** Зсув пальцем (пт) або швидкість (пт/мс), після яких перегляд закривається */
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.9;

/**
 * Перегляд фото на весь екран: гортання пальцем, лічильник, закриття кнопкою або свайпом вниз.
 * На iPhone фото можна збільшувати двома пальцями (поки воно збільшене, свайп вниз прокручує, а не закриває).
 * Компонент монтується лише на час перегляду.
 */
export function PhotoViewer({ photos, startIndex = 0, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  // Зсув фото вниз під час свайпу (анімоване значення, що живе весь час перегляду)
  const [drag] = useState(() => new Animated.Value(0));
  // Чи збільшене поточне фото: тоді жести віддаємо прокручуванню всередині фото (стан змінюється лише при переході межі)
  const [zoomed, setZoomed] = useState(false);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Перехоплюємо лише переважно вертикальний рух вниз; горизонтальний лишається для гортання фото
        onMoveShouldSetPanResponderCapture: (_, g) => !zoomed && g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
            Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(onClose);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag, height, onClose, zoomed],
  );

  // Чим нижче потягнули фото, тим прозоріший чорний фон
  const backdrop = drag.interpolate({ inputRange: [0, height * 0.5], outputRange: [1, 0.15], extrapolate: 'clamp' });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} {...pan.panHandlers}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]} />

        <Animated.View style={[styles.content, { transform: [{ translateY: drag }] }]}>
          <FlatList
            data={photos}
            keyExtractor={(uri, i) => `${uri}-${i}`}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(startIndex, photos.length - 1)}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setZoomed(false);
              setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
            renderItem={({ item }) => (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ width, height, alignItems: 'center', justifyContent: 'center' }}
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                scrollEventThrottle={16}
                onScroll={(e) => {
                  setZoomed((e.nativeEvent.zoomScale ?? 1) > 1.02);
                }}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}>
                <Image source={{ uri: thumbnailUrl(item, 1600) }} style={{ width, height }} contentFit="contain" accessibilityLabel="Фото авто" />
              </ScrollView>
            )}
          />
        </Animated.View>

        <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
          <View style={styles.counter}>
            <ThemedText type="smallBold" style={styles.counterText}>
              {index + 1} / {photos.length}
            </ThemedText>
          </View>
          <IconButton icon="close" label="Закрити" tone="neutral" size={40} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  content: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.three },
  counter: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Radius.pill },
  counterText: { color: '#FFFFFF' },
});
