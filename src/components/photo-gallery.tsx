import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CarPhoto } from './car-photo';
import { PhotoViewer } from './photo-viewer';
import { ThemedText } from './themed-text';
import { Icon } from './ui/icon';

/** Галерея фото з гортанням пальцем, лічильником і крапками; тап відкриває фото на весь екран */
export function PhotoGallery({ photos, bleed }: { photos: string[]; /** Фото на всю ширину екрана без округлення, під прозорим хедером; лічильник і крапки вище, бо знизу їх перекриває лист із назвою */ bleed?: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // Номер фото, відкритого на весь екран; null — перегляд закритий
  const [viewing, setViewing] = useState<number | null>(null);

  const viewer = viewing !== null ? <PhotoViewer photos={photos} startIndex={viewing} onClose={() => setViewing(null)} /> : null;

  if (photos.length === 0) return <CarPhoto style={[styles.photo, bleed && styles.bleedPhoto]} iconSize={44} />;

  const open = (i: number) => (
    <Pressable key={i} accessibilityRole="button" accessibilityLabel="Відкрити фото на весь екран" onPress={() => setViewing(i)}>
      <CarPhoto uri={photos[i]} style={[styles.photo, bleed && styles.bleedPhoto, width > 0 && photos.length > 1 && { width }]} iconSize={44} />
    </Pressable>
  );

  if (photos.length === 1) {
    return (
      <View style={[styles.wrap, bleed && styles.bleed]}>
        {open(0)}
        <ExpandHint bleed={bleed} />
        {viewer}
      </View>
    );
  }

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={[styles.wrap, bleed && styles.bleed]}>
      {width > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ index: i }) => open(i)}
          style={styles.list}
        />
      ) : (
        <View style={styles.photo} />
      )}
      <View style={[styles.counter, bleed && styles.counterBleed]}>
        <ThemedText type="small" style={styles.counterText}>
          {index + 1} / {photos.length}
        </ThemedText>
      </View>
      <ExpandHint bleed={bleed} />
      <View style={[styles.dots, bleed && styles.dotsBleed]}>
        {photos.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === index ? theme.accent : 'rgba(255,255,255,0.7)' }]} />
        ))}
      </View>
      {viewer}
    </View>
  );
}

/** Іконка в куті підказує, що фото можна відкрити на весь екран */
function ExpandHint({ bleed }: { bleed?: boolean }) {
  return (
    <View style={[styles.expand, bleed && styles.expandBleed]} pointerEvents="none">
      <Icon name="expand-outline" size={16} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg, overflow: 'hidden' },
  list: { flex: 1 },
  bleed: { aspectRatio: 1.2, borderRadius: 0 },
  bleedPhoto: { aspectRatio: 1.2, borderRadius: 0 },
  counterBleed: { top: undefined, bottom: 44 + Spacing.two, right: Spacing.three },
  dotsBleed: { bottom: 44 },
  expandBleed: { bottom: 44 + Spacing.two, right: Spacing.three },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  counter: { position: 'absolute', top: Spacing.two, right: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' },
  counterText: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: 600 },
  expand: { position: 'absolute', right: Spacing.two, bottom: Spacing.two, padding: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.55)' },
  dots: { position: 'absolute', bottom: Spacing.two, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
