import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../themed-text';
import { Card } from './card';
import { Icon, type IconName } from './icon';

/** Блок налаштувань із заголовком; рядки розділені лініями */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children);

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {title.toUpperCase()}
      </ThemedText>
      <Card style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

type RowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Червоний рядок для небезпечних дій */
  danger?: boolean;
  /** Власний вміст справа замість шеврона */
  right?: ReactNode;
};

export function SettingsRow({ icon, title, subtitle, onPress, danger, right }: RowProps) {
  const theme = useTheme();
  const tone = danger ? 'negative' : 'accent';

  const content = (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: danger ? theme.negativeSoft : theme.accentSoft }]}>
        <Icon name={icon} size={20} color={tone} />
      </View>
      <View style={styles.text}>
        <ThemedText type="default" themeColor={danger ? 'negative' : 'text'} style={styles.rowTitle}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color="textSecondary" /> : null)}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  title: { marginLeft: Spacing.one, fontSize: 12 },
  card: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  icon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  rowTitle: { fontWeight: 600 },
  pressed: { opacity: 0.6 },
});
