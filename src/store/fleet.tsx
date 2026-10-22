import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { api, ApiError } from '@/lib/api';
import { cancelNotifications, scheduleReminder } from '@/lib/notifications';
import { FREE_CAR_LIMIT, PRO_CAR_LIMIT, type Car, type Reminder, type Transaction } from '@/types';

import { MOCK_CARS, MOCK_REMINDERS, MOCK_TRANSACTIONS } from './mock';
import { useAuth } from './auth';

type Data = {
  email: string;
  cars: Car[];
  transactions: Transaction[];
  reminders: Reminder[];
  isPro: boolean;
  onboarded: boolean;
  /** Підказки, які користувач уже закрив */
  dismissedHints: string[];
};

/** Відповідь GET /data і POST /data/import */
type ServerData = {
  user: { email: string; isPro: boolean; onboarded: boolean; dismissedHints: string[] };
  cars: Car[];
  transactions: Transaction[];
  reminders: Reminder[];
};

const EMPTY: Data = { email: '', cars: [], transactions: [], reminders: [], isPro: false, onboarded: false, dismissedHints: [] };

const fromServer = ({ user, cars, transactions, reminders }: ServerData): Data => ({
  email: user.email,
  cars,
  transactions,
  reminders,
  isPro: user.isPro,
  onboarded: user.onboarded,
  dismissedHints: user.dismissedHints,
});

type NewCar = Omit<Car, 'id'>;
type NewTransaction = Omit<Transaction, 'id'>;

type FleetContextValue = Data & {
  /** Дані завантажені з сервера */
  ready: boolean;
  loadError: string | null;
  reload: () => void;
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
  loadDemo: () => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
};

const FleetContext = createContext<FleetContextValue | null>(null);

type Loaded = { forToken: string; data: Data | null; error: string | null };

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Не вдалося виконати запит');

/** Стор, що працює через REST API (NestJS + MongoDB). Дані завантажуються після входу. */
export function FleetProvider({ children }: { children: ReactNode }) {
  const { token, signOut } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<ServerData>('GET', '/data')
      .then((res) => !cancelled && setLoaded({ forToken: token, data: fromServer(res), error: null }))
      .catch((e) => !cancelled && setLoaded({ forToken: token, data: null, error: messageOf(e) }));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // Дані «чужого» токена (після виходу чи входу під іншим акаунтом) ігноруємо
  const current = loaded && loaded.forToken === token ? loaded : null;
  const data = current?.data ?? EMPTY;
  const ready = !!current?.data;

  const patch = useCallback((fn: (d: Data) => Data) => {
    setLoaded((l) => (l?.data ? { ...l, data: fn(l.data) } : l));
  }, []);

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
        patch((d) => ({ ...d, cars: [...d.cars, created] }));
      }),
    [run, patch],
  );

  const updateCar = useCallback(
    (id: string, changes: Partial<NewCar>) =>
      run(async () => {
        const updated = await api<Car>('PATCH', `/cars/${id}`, changes);
        patch((d) => ({ ...d, cars: d.cars.map((c) => (c.id === id ? updated : c)) }));
      }),
    [run, patch],
  );

  const deleteCar = useCallback(
    (id: string) =>
      run(async () => {
        await api('DELETE', `/cars/${id}`);
        patch((d) => {
          d.reminders.filter((r) => r.carId === id).forEach((r) => void cancelNotifications(r.notificationIds));
          return {
            ...d,
            cars: d.cars.filter((c) => c.id !== id),
            transactions: d.transactions.filter((t) => t.carId !== id),
            reminders: d.reminders.filter((r) => r.carId !== id),
          };
        });
      }),
    [run, patch],
  );

  const addTransaction = useCallback(
    (tx: NewTransaction) =>
      run(async () => {
        const created = await api<Transaction>('POST', '/transactions', tx);
        patch((d) => ({ ...d, transactions: [created, ...d.transactions] }));
      }),
    [run, patch],
  );

  const updateTransaction = useCallback(
    (id: string, changes: Partial<NewTransaction>) =>
      run(async () => {
        const updated = await api<Transaction>('PATCH', `/transactions/${id}`, changes);
        patch((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? updated : t)) }));
      }),
    [run, patch],
  );

  const deleteTransaction = useCallback(
    (id: string) =>
      run(async () => {
        await api('DELETE', `/transactions/${id}`);
        patch((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
      }),
    [run, patch],
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
    (changes: Partial<Pick<Data, 'isPro' | 'onboarded' | 'dismissedHints'>>) =>
      run(async () => {
        await api('PATCH', '/me', changes);
        patch((d) => ({ ...d, ...changes }));
      }),
    [run, patch],
  );

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

  const loadDemo = useCallback(
    () =>
      run(async () => {
        // id у демо-даних — лише посилання для зв'язків; сервер створює справжні
        const res = await api<ServerData>('POST', '/data/import', {
          cars: MOCK_CARS,
          transactions: MOCK_TRANSACTIONS,
          reminders: MOCK_REMINDERS,
        });
        data.reminders.forEach((r) => void cancelNotifications(r.notificationIds));
        patch((d) => ({ ...fromServer(res), onboarded: d.onboarded || res.user.onboarded }));
      }),
    [run, patch, data.reminders],
  );

  const clearAll = useCallback(
    () =>
      run(async () => {
        await api('DELETE', '/data');
        data.reminders.forEach((r) => void cancelNotifications(r.notificationIds));
        patch((d) => ({ ...d, cars: [], transactions: [], reminders: [] }));
      }),
    [run, patch, data.reminders],
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
      loadError: current?.error ?? null,
      reload,
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
      loadDemo,
      clearAll,
      deleteAccount,
    }),
    [data, ready, current?.error, reload, carLimit, addCar, updateCar, deleteCar, addTransaction, updateTransaction, deleteTransaction, addReminder, toggleReminder, deleteReminder, setPro, finishOnboarding, dismissHint, resetHints, loadDemo, clearAll, deleteAccount],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used inside FleetProvider');
  return ctx;
}
