import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from './ui/icon';

/** Кругла кнопка поверх фото: біла напівпрозора, щоб читалась на будь-якому знімку */
export function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={styles.button}>
      <Icon name={icon} size={22} color="#222222" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
});
