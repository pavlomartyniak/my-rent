import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/**
 * Пояснення, куди поділись прийняті домовленості: щойно запит чи пропозиція стають орендою, вони живуть в одному місці
 * («Головна» в орендаря, екран авто у власника), а не дублюються в кількох списках з різними статусами.
 */
export function MovedNote({ text, onPress }: { text: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <View style={[styles.box, { backgroundColor: theme.positiveSoft, borderColor: theme.positive }]}>
        <Icon name="car-sport" size={22} color="positive" />
        <ThemedText type="smallBold" themeColor="positive" style={styles.text}>
          {text}
        </ThemedText>
        <Icon name="chevron-forward" size={18} color="positive" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  text: { flex: 1 },
});
