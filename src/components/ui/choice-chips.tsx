import { Pressable, StyleSheet, View } from 'react-native';

import { MinHit, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { ThemedText } from '../themed-text';
import { Icon } from './icon';

type Option = { value: string; label: string };

type Props = { label: string; hint?: string; options: readonly Option[] } & (
  | { multi?: false; value: string; onChange: (value: string) => void }
  | { multi: true; value: string[]; onChange: (value: string[]) => void }
);

/**
 * Питання з варіантами відповідей. Одна відповідь (radio): повторний тап прибирає вибір. Кілька відповідей
 * (checkbox): тап додає чи прибирає. Вибране видно не лише кольором: галочка й рамка.
 */
export function ChoiceChips(props: Props) {
  const theme = useTheme();
  const { label, hint, options } = props;
  const selected = (v: string) => (props.multi ? props.value.includes(v) : props.value === v);

  function press(v: string) {
    haptic.select();
    if (props.multi) props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(props.value === v ? '' : v);
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="headline" accessibilityRole="header">
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="callout" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <View style={styles.chips} accessibilityRole={props.multi ? undefined : 'radiogroup'}>
        {options.map((o) => {
          const on = selected(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole={props.multi ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on, selected: on }}
              onPress={() => press(o.value)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: on ? theme.accentSoft : theme.backgroundElement, borderColor: on ? theme.accent : theme.borderStrong },
                pressed && { opacity: 0.7 },
              ]}>
              {on ? <Icon name="checkmark" size={16} color="accent" /> : null}
              <ThemedText type="callout" themeColor={on ? 'accent' : 'text'} style={styles.text}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: MinHit, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1 },
  text: { fontWeight: 600 },
});
