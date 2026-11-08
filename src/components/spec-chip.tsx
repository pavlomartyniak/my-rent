import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon, type IconName } from './ui/icon';

/** Дрібна характеристика авто: іконка й текст у пігулці (сірій у картках, білою з рамкою на тлі сторінки) */
export function SpecChip({ icon, text, white }: { icon: IconName; text: string; white?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, white ? { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 } : { backgroundColor: theme.backgroundSelected }]}>
      <Icon name={icon} size={15} color="textSecondary" />
      <ThemedText type="smallBold" numberOfLines={1}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
});
