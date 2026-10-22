import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

type Props = {
  uri?: string;
  /** Розмір і округлення задає викликач */
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
  /** Підпис на заглушці, коли фото немає */
  placeholder?: string;
};

/** Фото авто; якщо його немає — заглушка з іконкою */
export function CarPhoto({ uri, style, iconSize = 28, placeholder }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.box, { backgroundColor: theme.accentSoft }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Фото авто" />
      ) : (
        <>
          <Icon name="car-sport" size={iconSize} color="accent" />
          {placeholder ? (
            <ThemedText type="smallBold" themeColor="accent" style={styles.label}>
              {placeholder}
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: Spacing.one },
});
