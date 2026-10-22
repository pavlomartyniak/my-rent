import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceValue = { preference: ThemePreference; setPreference: (p: ThemePreference) => void };

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

/**
 * Обрана користувачем тема. Appearance.setColorScheme перемикає схему для всього
 * застосунку разом із нативними елементами (таб-бар, календар, діалоги).
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const value = useMemo(() => ({ preference, setPreference }), [preference]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  return ctx;
}
