import { useState } from 'react';
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { CarPhoto } from './car-photo';
import { ThemedText } from './themed-text';

/** Галерея фото з гортанням пальцем, лічильником і крапками */
export function PhotoGallery({ photos }: { photos: string[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  if (photos.length <= 1) return <CarPhoto uri={photos[0]} style={styles.photo} iconSize={44} />;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
      {width > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => <CarPhoto uri={item} style={[styles.photo, { width }]} iconSize={44} />}
          style={styles.list}
        />
      ) : (
        <View style={styles.photo} />
      )}
      <View style={[styles.counter, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <ThemedText type="small" style={styles.counterText}>
          {index + 1} / {photos.length}
        </ThemedText>
      </View>
      <View style={styles.dots}>
        {photos.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === index ? theme.accent : 'rgba(255,255,255,0.7)' }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg, overflow: 'hidden' },
  list: { flex: 1 },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg },
  counter: { position: 'absolute', top: Spacing.two, right: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.pill },
  counterText: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, fontWeight: 600 },
  dots: { position: 'absolute', bottom: Spacing.two, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
