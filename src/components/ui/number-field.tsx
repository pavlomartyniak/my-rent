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
  /** Без роздільників тисяч: для років, номерів тощо («2015», а не «2 015») */
  plain?: boolean;
};

/**
 * Числове поле, у якому тисячі розділені пробілами під час набору («650 000»).
 * Стан зберігає чисті цифри, форматування — лише у відображенні.
 */
export function NumberField({ value, onChangeValue, maxDigits = 12, plain, ...rest }: Props) {
  return (
    <Field
      {...rest}
      value={plain ? value : groupDigits(value)}
      keyboardType="number-pad"
      onChangeText={(text) => onChangeValue(text.replace(/\D/g, '').slice(0, maxDigits).replace(/^0+(?=\d)/, ''))}
    />
  );
}
