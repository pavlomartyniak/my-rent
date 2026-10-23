import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'my-rent.theme';
export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

type ThemePreferenceValue = { preference: ThemePreference; setPreference: (p: ThemePreference) => void };

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

/**
 * Обрана користувачем тема. Appearance.setColorScheme перемикає схему для всього
 * застосунку разом із нативними елементами (таб-бар, календар, діалоги).
 *
 * Останній вибір кешується на пристрої, щоб застосунок відкривався одразу в потрібній темі;
 * після входу її синхронізує з акаунтом стор (див. FleetProvider).
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((saved) => isThemePreference(saved) && setPreferenceState(saved))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    SecureStore.setItemAsync(KEY, value).catch(() => {});
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  return ctx;
}
