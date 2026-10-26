import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/** Колір і розмір символа збігаються з нативним заставкою (app.json), щоб перехід був непомітним */
const BRAND = '#3D39CC';
const SYMBOL = 120;
const HOLD = 180;
const DURATION = 420;

/**
 * Заставка поверх застосунку: той самий синій екран із символом, що й нативна, тож між ними немає стрибка.
 * Коли застосунок готовий, нативну заставку знімаємо, трохи затримуємось і плавно розчиняємо екран,
 * а символ м'яко збільшується, ніби «вилітає» назустріч користувачу.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [started, setStarted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  if (!visible) return null;

  const start = () => {
    if (started) return;
    setStarted(true);
    void SplashScreen.hideAsync().finally(() => {
      Animated.timing(progress, { toValue: 1, duration: DURATION, delay: HOLD, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    });
  };

  return (
    <Animated.View pointerEvents="none" onLayout={start} style={[styles.overlay, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <Image source={require('@/assets/images/splash-icon.png')} style={styles.symbol} contentFit="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  symbol: { width: SYMBOL, height: SYMBOL },
});
