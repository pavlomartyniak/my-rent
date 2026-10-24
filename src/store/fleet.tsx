import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { api, ApiError } from '@/lib/api';
import type { Profile } from '@/lib/profile';
import { cancelNotifications, scheduleReminder } from '@/lib/notifications';
import { FREE_CAR_LIMIT, PRO_CAR_LIMIT, type Car, type Reminder, type Role, type Transaction } from '@/types';

import { useAuth } from './auth';
import { isThemePreference, useThemePreference, type ThemePreference } from './theme';

type Data = Profile & {
  email: string;
  /** Тип акаунта: власник авто чи орендар */
  role: Role;
  cars: Car[];
  reminders: Reminder[];
  isPro: boolean;
  onboarded: boolean;
  /** Підказки, які користувач уже закрив */
  dismissedHints: string[];
  theme: ThemePreference;
};

/** Відповідь GET /data і POST /data/import */
type ServerData = {
  user: Partial<Profile> & { email: string; role?: Role; isPro: boolean; onboarded: boolean; dismissedHints: string[]; theme?: ThemePreference };
  cars: Car[];
  reminders: Reminder[];
};

const EMPTY: Data = { email: '', role: 'owner', firstName: '', lastName: '', phone: '', cars: [], reminders: [], isPro: false, onboarded: false, dismissedHints: [], theme: 'system' };

const fromServer = ({ user, cars, reminders }: ServerData): Data => ({
  email: user.email,
  role: user.role === 'renter' ? 'renter' : 'owner',
  firstName: user.firstName ?? '',
  lastName: user.lastName ?? '',
  phone: user.phone ?? '',
  cars,
  reminders,
  isPro: user.isPro,
  onboarded: user.onboarded,
  dismissedHints: user.dismissedHints,
  theme: isThemePreference(user.theme) ? user.theme : 'system',
});

type NewCar = Omit<Car, 'id'>;
type NewTransaction = Omit<Transaction, 'id' | 'carId'> & { carId?: string };

type FleetContextValue = Data & {
  /** Дані завантажені з сервера */
  ready: boolean;
  /** Збільшується після змін авто й записів: за ним звіти завантажуються наново */
  dataVersion: number;
  loadError: string | null;
  reload: () => void;
  /** Позначити, що дані змінились поза стором (запити на оренду): звіти й списки завантажаться наново */
  invalidate: () => void;
  carLimit: number;
  canAddCar: boolean;
  // Усі зміни йдуть на сервер; повертають true, якщо вдалося (помилку показують самі)
  addCar: (car: NewCar) => Promise<boolean>;
  updateCar: (id: string, patch: Partial<NewCar>) => Promise<boolean>;
  deleteCar: (id: string) => Promise<boolean>;
  addTransaction: (tx: NewTransaction) => Promise<boolean>;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  addReminder: (reminder: Pick<Reminder, 'carId' | 'kind' | 'date'>) => Promise<boolean>;
  toggleReminder: (id: string) => Promise<boolean>;
  deleteReminder: (id: string) => Promise<boolean>;
  setPro: (value: boolean) => Promise<boolean>;
  finishOnboarding: () => Promise<boolean>;
  dismissHint: (id: string) => void;
  resetHints: () => Promise<boolean>;
  /** Змінює тему одразу й зберігає її в акаунті */
  setTheme: (value: ThemePreference) => Promise<boolean>;
  updateProfile: (changes: Partial<Profile>) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
};

const FleetContext = createContext<FleetContextValue | null>(null);

type Loaded = { forToken: string; data: Data | null; error: string | null };

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Не вдалося виконати запит');

/** Стор, що працює через REST API (NestJS + MongoDB). Дані завантажуються після входу. */
export function FleetProvider({ children }: { children: ReactNode }) {
  const { token, signOut } = useAuth();
  const { setPreference } = useThemePreference();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<ServerData>('GET', '/data')
      .then((res) => {
        if (cancelled) return;
        setLoaded({ forToken: token, data: fromServer(res), error: null });
        // Тема з акаунта має пріоритет над кешем на пристрої
        if (isThemePreference(res.user.theme)) setPreference(res.user.theme);
      })
      .catch((e) => !cancelled && setLoaded({ forToken: token, data: null, error: messageOf(e) }));
    return () => {
      cancelled = true;
    };
  }, [token, attempt, setPreference]);

  // Дані «чужого» токена (після виходу чи входу під іншим акаунтом) ігноруємо
  const current = loaded && loaded.forToken === token ? loaded : null;
  const data = current?.data ?? EMPTY;
  const ready = !!current?.data;

  const patch = useCallback((fn: (d: Data) => Data) => {
    setLoaded((l) => (l?.data ? { ...l, data: fn(l.data) } : l));
  }, []);

  /** Сигналізує звітам та історії, що цифри змінились, і вони завантажаться наново */
  const touch = useCallback(() => setDataVersion((v) => v + 1), []);

  /** Як patch, але ще й оновлює звіти */
  const patchData = useCallback(
    (fn: (d: Data) => Data) => {
      patch(fn);
      touch();
    },
    [patch, touch],
  );

  /** Виконує запит; при помилці показує повідомлення й повертає false */
  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      return true;
    } catch (e) {
      Alert.alert('Помилка', messageOf(e));
      return false;
    }
  }, []);

  const addCar = useCallback(
    (car: NewCar) =>
      run(async () => {
        const created = await api<Car>('POST', '/cars', car);
        patchData((d) => ({ ...d, cars: [...d.cars, created] }));
      }),
    [run, patchData],
  );

  const updateCar = useCallback(
    (id: string, changes: Partial<NewCar>) =>
      run(async () => {
        const updated = await api<Car>('PATCH', `/cars/${id}`, changes);
        patchData((d) => ({ ...d, cars: d.cars.map((c) => (c.id === id ? updated : c)) }));
      }),
    [run, patchData],
  );

  const deleteCar = useCallback(
    (id: string) =>
      run(async () => {
        await api('DELETE', `/cars/${id}`);
        patchData((d) => {
          d.reminders.filter((r) => r.carId === id).forEach((r) => void cancelNotifications(r.notificationIds));
          return {
            ...d,
            cars: d.cars.filter((c) => c.id !== id),
            reminders: d.reminders.filter((r) => r.carId !== id),
          };
        });
      }),
    [run, patchData],
  );

  const addTransaction = useCallback(
    (tx: NewTransaction) =>
      run(async () => {
        await api<Transaction>('POST', '/transactions', tx);
        touch();
      }),
    [run, touch],
  );

  const updateTransaction = useCallback(
    (id: string, changes: Partial<NewTransaction>) =>
      run(async () => {
        await api<Transaction>('PATCH', `/transactions/${id}`, changes);
        touch();
      }),
    [run, touch],
  );

  const deleteTransaction = useCallback(
    (id: string) =>
      run(async () => {
        await api('DELETE', `/transactions/${id}`);
        touch();
      }),
    [run, touch],
  );

  const addReminder = useCallback(
    (input: Pick<Reminder, 'carId' | 'kind' | 'date'>) =>
      run(async () => {
        let created = await api<Reminder>('POST', '/reminders', input);
        // Локальні сповіщення планує сам пристрій; їхні id зберігаємо, щоб скасувати при виконанні/видаленні
        const notificationIds = await scheduleReminder(created, data.cars.find((c) => c.id === input.carId)).catch(() => []);
        if (notificationIds.length) {
          created = await api<Reminder>('PATCH', `/reminders/${created.id}`, { notificationIds });
        }
        patch((d) => ({ ...d, reminders: [...d.reminders, created] }));
      }),
    [run, patch, data.cars],
  );

  const toggleReminder = useCallback(
    (id: string) =>
      run(async () => {
        const current = data.reminders.find((r) => r.id === id);
        if (!current) return;
        const done = !current.done;
        const updated = await api<Reminder>('PATCH', `/reminders/${id}`, done ? { done, notificationIds: [] } : { done });
        if (done) void cancelNotifications(current.notificationIds);
        patch((d) => ({ ...d, reminders: d.reminders.map((r) => (r.id === id ? updated : r)) }));
      }),
    [run, patch, data.reminders],
  );

  const deleteReminder = useCallback(
    (id: string) =>
      run(async () => {
        const current = data.reminders.find((r) => r.id === id);
        await api('DELETE', `/reminders/${id}`);
        void cancelNotifications(current?.notificationIds);
        patch((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }));
      }),
    [run, patch, data.reminders],
  );

  const updateMe = useCallback(
    (changes: Partial<Pick<Data, 'isPro' | 'onboarded' | 'dismissedHints' | 'theme' | 'firstName' | 'lastName' | 'phone'>>) =>
      run(async () => {
        await api('PATCH', '/me', changes);
        patch((d) => ({ ...d, ...changes }));
      }),
    [run, patch],
  );

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      setPreference(theme); // застосовуємо миттєво, не чекаючи сервера
      return updateMe({ theme });
    },
    [setPreference, updateMe],
  );

  const updateProfile = useCallback((changes: Partial<Profile>) => updateMe(changes), [updateMe]);

  const setPro = useCallback((isPro: boolean) => updateMe({ isPro }), [updateMe]);
  const finishOnboarding = useCallback(() => updateMe({ onboarded: true }), [updateMe]);
  const resetHints = useCallback(() => updateMe({ dismissedHints: [] }), [updateMe]);

  // Підказку закриваємо одразу, а на сервер зберігаємо у фоні
  const dismissHint = useCallback(
    (id: string) => {
      if (data.dismissedHints.includes(id)) return;
      const dismissedHints = [...data.dismissedHints, id];
      patch((d) => ({ ...d, dismissedHints }));
      api('PATCH', '/me', { dismissedHints }).catch(() => {});
    },
    [patch, data.dismissedHints],
  );

  const clearAll = useCallback(
    () =>
      run(async () => {
        await api('DELETE', '/data');
        data.reminders.forEach((r) => void cancelNotifications(r.notificationIds));
        patchData((d) => ({ ...d, cars: [], reminders: [] }));
      }),
    [run, patchData, data.reminders],
  );

  const deleteAccount = useCallback(
    () =>
      run(async () => {
        await api('DELETE', '/me');
        data.reminders.forEach((r) => void cancelNotifications(r.notificationIds));
        await signOut();
      }),
    [run, signOut, data.reminders],
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const carLimit = data.isPro ? PRO_CAR_LIMIT : FREE_CAR_LIMIT;

  const value = useMemo<FleetContextValue>(
    () => ({
      ...data,
      ready,
      dataVersion,
      loadError: current?.error ?? null,
      reload,
      invalidate: touch,
      carLimit,
      canAddCar: data.cars.length < carLimit,
      addCar,
      updateCar,
      deleteCar,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addReminder,
      toggleReminder,
      deleteReminder,
      setPro,
      finishOnboarding,
      dismissHint,
      resetHints,
      setTheme,
      updateProfile,
      clearAll,
      deleteAccount,
    }),
    [data, ready, dataVersion, current?.error, reload, touch, carLimit, addCar, updateCar, deleteCar, addTransaction, updateTransaction, deleteTransaction, addReminder, toggleReminder, deleteReminder, setPro, finishOnboarding, dismissHint, resetHints, setTheme, updateProfile, clearAll, deleteAccount],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used inside FleetProvider');
  return ctx;
}
