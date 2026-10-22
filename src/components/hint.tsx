import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFleet } from '@/store/fleet';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';
import { IconButton } from './ui/icon-button';

/** Підказка, яка показується, доки користувач її не закриє */
export function Hint({ id, children }: { id: string; children: string }) {
  const theme = useTheme();
  const { dismissedHints, dismissHint } = useFleet();

  if (dismissedHints.includes(id)) return null;

  return (
    <View style={[styles.box, { backgroundColor: theme.accentSoft }]}>
      <Icon name="bulb-outline" size={22} color="accent" />
      <ThemedText type="small" style={styles.text}>
        {children}
      </ThemedText>
      <IconButton icon="close" label="Закрити підказку" tone="neutral" size={32} onPress={() => dismissHint(id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  text: { flex: 1 },
});
