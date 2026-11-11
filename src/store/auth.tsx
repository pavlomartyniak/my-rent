import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setApiToken, setUnauthorizedHandler, wakeUpServer } from '@/lib/api';
import type { Profile } from '@/lib/profile';
import type { Role } from '@/types';

const TOKEN_KEY = 'my-rent.token';

type AuthContextValue = {
  /** 'loading' — читаємо збережений токен */
  status: 'loading' | 'out' | 'in';
  token: string | null;
  /** Повертає текст помилки або null, якщо успішно */
  login: (email: string, password: string) => Promise<string | null>;
  /** Перший крок реєстрації: надсилає код на пошту, акаунта ще немає. Повертає помилку або секунди до можливості надіслати код ще раз */
  register: (email: string, password: string, profile: Profile, role: Role) => Promise<{ error?: string; resendInSeconds?: number }>;
  /** Другий крок: код із листа створює акаунт і входить. Повертає текст помилки або null */
  confirmRegistration: (email: string, code: string) => Promise<string | null>;
  /** Надсилає код реєстрації ще раз */
  resendRegistration: (email: string) => Promise<{ error?: string; resendInSeconds?: number }>;
  /** Задає новий пароль за кодом із листа й одразу входить */
  resetPassword: (email: string, code: string, password: string) => Promise<string | null>;
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
    async (path: '/auth/login' | '/auth/register/verify' | '/auth/reset', body: Record<string, string>) => {
      try {
        const res = await api<{ token: string }>('POST', path, body);
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
      login: (email, password) => authenticate('/auth/login', { email: email.trim(), password }),
      register: async (email, password, profile, role) => {
        try {
          const res = await api<{ resendInSeconds: number }>('POST', '/auth/register', {
            role,
            email: email.trim(),
            password,
            firstName: profile.firstName.trim(),
            lastName: profile.lastName.trim(),
            phone: profile.phone.trim(),
          });
          return { resendInSeconds: res.resendInSeconds };
        } catch (e) {
          return { error: e instanceof ApiError ? e.message : 'Не вдалося виконати запит' };
        }
      },
      confirmRegistration: (email, code) => authenticate('/auth/register/verify', { email: email.trim(), code: code.trim() }),
      resendRegistration: async (email) => {
        try {
          const res = await api<{ resendInSeconds: number }>('POST', '/auth/register/resend', { email: email.trim() });
          return { resendInSeconds: res.resendInSeconds };
        } catch (e) {
          return { error: e instanceof ApiError ? e.message : 'Не вдалося надіслати код. Спробуйте ще раз' };
        }
      },
      resetPassword: (email, code, password) => authenticate('/auth/reset', { email: email.trim(), code: code.trim(), password }),
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
