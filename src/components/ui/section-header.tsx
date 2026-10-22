import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from '../themed-text';
import { PillButton } from './pill-button';

type Props = { title: string; action?: string; onAction?: () => void };

export function SectionHeader({ title, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <ThemedText type="default" style={styles.title}>
        {title}
      </ThemedText>
      {action && onAction ? <PillButton title={action} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.two, marginBottom: -Spacing.one, minHeight: 36 },
  title: { fontWeight: 700, fontSize: 18 },
});
