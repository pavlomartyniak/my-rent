import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';
import { thumbnailUrl } from '@/lib/media';

import { ThemedText } from './themed-text';

/** Круглий аватар: фото профілю або ініціали на м'якому фоні */
export function Avatar({ uri, name, size = 44 }: { uri?: string | null; name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentSoft }]}>
      {uri ? (
        <Image source={{ uri: thumbnailUrl(uri, Math.max(200, size * 3)) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Фото: ${name}`} />
      ) : (
        <ThemedText themeColor="accent" style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46), fontWeight: 700 }}>
          {initials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
