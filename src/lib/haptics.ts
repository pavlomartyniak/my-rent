import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Відгук на дотик. Помилки ігноруємо: на частині пристроїв і в вебі вібрації немає. */
const safe = (run: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  run().catch(() => undefined);
};

export const haptic = {
  /** Легкий дотик: вибір чіпа, перемикача, вкладки */
  select: () => safe(() => Haptics.selectionAsync()),
  /** Підтвердження головної дії */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
