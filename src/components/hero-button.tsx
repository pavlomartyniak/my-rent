import { Pressable, StyleSheet } from 'react-native';

import { haptic } from '@/lib/haptics';

import { Icon, type IconName } from './ui/icon';

/** Кругла кнопка поверх фото: біла напівпрозора з легкою тінню, щоб читалась на будь-якому знімку. Розмір 44, зона натискання більша. */
export function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={22} color="#222222" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
