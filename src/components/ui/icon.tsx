import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: ThemeColor | (string & {}) };

export function Icon({ name, size = 20, color = 'text' }: Props) {
  const theme = useTheme();
  const resolved = color in theme ? theme[color as ThemeColor] : color;
  return <Ionicons name={name} size={size} color={resolved} />;
}
