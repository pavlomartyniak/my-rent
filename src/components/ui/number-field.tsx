import type { TextInputProps } from 'react-native';

import { groupDigits } from '@/lib/format';

import { Field } from './field';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  label: string;
  /** Лише цифри, без розділювачів */
  value: string;
  onChangeValue: (digits: string) => void;
  maxDigits?: number;
  error?: string;
};

/**
 * Числове поле, у якому тисячі розділені пробілами під час набору («650 000»).
 * Стан зберігає чисті цифри, форматування — лише у відображенні.
 */
export function NumberField({ value, onChangeValue, maxDigits = 12, ...rest }: Props) {
  return (
    <Field
      {...rest}
      value={groupDigits(value)}
      keyboardType="number-pad"
      onChangeText={(text) => onChangeValue(text.replace(/\D/g, '').slice(0, maxDigits).replace(/^0+(?=\d)/, ''))}
    />
  );
}
