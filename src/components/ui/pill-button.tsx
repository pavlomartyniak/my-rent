import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { haptic } from '@/lib/haptics';

import { ThemedText } from '../themed-text';
import { Icon, type IconName } from './icon';

type Props = { title: string; icon?: IconName; onPress: () => void };

/** Компактна кнопка-«пігулка» для другорядних дій (замість текстових посилань) */
export function PillButton({ title, icon, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.backgroundSelected, borderColor: 'transparent' },
        pressed && styles.pressed,
      ]}>
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={16} color="text" /> : null}
        <ThemedText type="smallBold" themeColor="text" numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
