import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Державний номер у вигляді номерного знака: синя смужка «UA» і номер у рамці */
export function PlateBadge({ plate, small }: { plate: string; small?: boolean }) {
  const theme = useTheme();
  const h = small ? 22 : 28;
  return (
    <View accessible accessibilityLabel={`Державний номер ${plate}`} style={[styles.plate, { height: h, borderColor: theme.borderStrong, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.strip, { width: small ? 14 : 18 }]}>
        <ThemedText style={[styles.ua, { fontSize: small ? 7 : 8, lineHeight: small ? 9 : 10 }]}>UA</ThemedText>
      </View>
      <ThemedText style={[styles.number, { fontSize: small ? 12 : 15, lineHeight: small ? 16 : 20 }]} numberOfLines={1}>
        {plate}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, overflow: 'hidden', paddingRight: 8 },
  strip: { height: '100%', backgroundColor: '#0057B8', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  ua: { color: '#FFD700', fontWeight: 700 },
  number: { fontWeight: 700, letterSpacing: 1 },
});
