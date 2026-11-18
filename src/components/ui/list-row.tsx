import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { MinHit, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Props = {
  title: string;
  subtitle?: string;
  /** Зліва: іконка, фото чи аватар */
  leading?: ReactNode;
  /** Справа замість шеврона: сума, статус, перемикач */
  trailing?: ReactNode;
  /** Є — рядок клікабельний і показує «›»; немає — статичний і не схожий на кнопку */
  onPress?: () => void;
  tone?: 'default' | 'danger';
  /** Підпис для скрінрідера; за замовчуванням «назва, підзаголовок» */
  label?: string;
};

/** Єдиний рядок списку (мін. висота 56). Шеврон — лише там, де рядок кудись веде. */
export function ListRow({ title, subtitle, leading, trailing, onPress, tone = 'default', label }: Props) {
  const theme = useTheme();

  const body = (
    <View style={styles.row}>
      {leading}
      <View style={styles.text}>
        <ThemedText type="body" themeColor={tone === 'danger' ? 'negative' : 'text'} style={styles.title} numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="callout" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={18} color="textSecondary" /> : null)}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? [title, subtitle].filter(Boolean).join(', ')}
      android_ripple={{ color: theme.border }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => pressed && Platform.OS === 'ios' && { backgroundColor: theme.backgroundSelected }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: Math.max(56, MinHit), paddingVertical: Spacing.two },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: 500 },
});
