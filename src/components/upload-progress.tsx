import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

const pct = (p: number) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;

/**
 * Круговий індикатор відправки поверх фото чи відео, як у Telegram: темне коло, дуга прогресу й хрестик, яким відправку можна скасувати.
 * Поки відсотків ще немає, дуга має невелику початкову довжину, щоб індикатор не був порожнім.
 */
export function UploadRing({ progress, size = 48, onCancel }: { progress: number; size?: number; onCancel?: () => void }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0.06, Math.min(1, progress));
  const body = (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#FFFFFF"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * shown} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {onCancel ? <Icon name="close" size={size * 0.45} color="#FFFFFF" /> : <ThemedText type="small" style={styles.percent}>{pct(progress)}</ThemedText>}
    </View>
  );
  return onCancel ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`Скасувати відправку, ${pct(progress)}`} onPress={onCancel} hitSlop={8}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Смужка прогресу з підписом для форм: поліс, фото стану авто, фото профілю */
export function UploadBar({ progress, label = 'Завантажуємо' }: { progress: number; label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <View style={styles.barText}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}…
        </ThemedText>
        <ThemedText type="smallBold">{pct(progress)}</ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: theme.accent, width: pct(Math.max(0.03, progress)) as `${number}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  percent: { color: '#FFFFFF', fontSize: 11, fontWeight: 700 },
  bar: { gap: Spacing.one },
  barText: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: Radius.pill },
});
