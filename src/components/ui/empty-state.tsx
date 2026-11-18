import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Button } from './button';
import { Icon, type IconName } from './icon';

type Props = { icon: IconName; title: string; text?: string; action?: string; onAction?: () => void };

export function EmptyState({ icon, title, text, action, onAction }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
        <Icon name={icon} size={28} color="text" />
      </View>
      <ThemedText type="headline" style={styles.center} accessibilityRole="header">
        {title}
      </ThemedText>
      {text ? (
        <ThemedText type="callout" themeColor="textSecondary" style={styles.center}>
          {text}
        </ThemedText>
      ) : null}
      {action ? <Button title={action} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  badge: { width: 72, height: 72, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: Spacing.two },
});
