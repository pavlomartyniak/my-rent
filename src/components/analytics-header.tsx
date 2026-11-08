import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Свій заголовок сторінки аналітики: кругла кнопка «Назад», мініатюра авто, назва й підпис */
export function AnalyticsHeader({ photoUri, title, subtitle }: { photoUri?: string; title: string; subtitle: string }) {
  const router = useRouter();
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Назад" hitSlop={8} onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Icon name="chevron-back" size={22} />
      </Pressable>
      <CarPhoto uri={photoUri} style={styles.thumb} iconSize={24} />
      <View style={styles.flex}>
        <ThemedText type="default" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  flex: { flex: 1 },
  title: { fontWeight: 700, fontSize: 22, letterSpacing: -0.3 },
});
