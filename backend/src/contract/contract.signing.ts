import { createHash } from 'node:crypto';

/** Підпис договору однією зі сторін. Зараз це підтвердження в застосунку; пізніше сюди підключається BankID чи Дія.Підпис. */
export type Signature = { at: Date; method: string; signatureId: string };

/** Спосіб підписання: `demo` — підтвердження в застосунку без перевірки особи */
export const SIGNING_METHOD_DEMO = 'demo';

/**
 * Створює підпис сторони під договором із даним відбитком. Ідентифікатор підпису прив'язаний до відбитку договору,
 * сторони й часу, тож його не можна перенести на інший текст.
 */
export function signContract(input: { contractHash: string; userId: string; role: 'owner' | 'renter'; at?: Date; method?: string }): Signature {
  const at = input.at ?? new Date();
  const method = input.method ?? SIGNING_METHOD_DEMO;
  const signatureId = createHash('sha256').update(`${input.contractHash}:${input.role}:${input.userId}:${at.toISOString()}:${method}`).digest('hex').slice(0, 16).toUpperCase();
  return { at, method, signatureId };
}

export const methodLabel = (method: string) => (method === SIGNING_METHOD_DEMO ? 'підтвердження в застосунку (демо)' : method);
