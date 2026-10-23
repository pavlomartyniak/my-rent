import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setApiToken, setUnauthorizedHandler, wakeUpServer } from '@/lib/api';

const TOKEN_KEY = 'my-rent.token';

type AuthContextValue = {
  /** 'loading' — читаємо збережений токен */
  status: 'loading' | 'out' | 'in';
  token: string | null;
  /** Повертає текст помилки або null, якщо успішно */
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Токен зберігається в захищеному сховищі пристрою (Keychain / Keystore) */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((value: string | null) => {
    setApiToken(value);
    setToken(value);
  }, []);

  const signOut = useCallback(async () => {
    apply(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, [apply]);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    wakeUpServer();
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((saved) => apply(saved))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apply]);

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/register', email: string, password: string) => {
      try {
        const res = await api<{ token: string }>('POST', path, { email: email.trim(), password });
        await SecureStore.setItemAsync(TOKEN_KEY, res.token).catch(() => {});
        apply(res.token);
        return null;
      } catch (e) {
        return e instanceof ApiError ? e.message : 'Не вдалося виконати запит';
      }
    },
    [apply],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status: loading ? 'loading' : token ? 'in' : 'out',
      token,
      login: (email, password) => authenticate('/auth/login', email, password),
      register: (email, password) => authenticate('/auth/register', email, password),
      signOut,
    }),
    [loading, token, authenticate, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
