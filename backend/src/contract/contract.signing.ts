import { createHash } from 'node:crypto';

/**
 * Підпис договору однією зі сторін. Це простий електронний підпис: підтвердження одноразовим кодом з пошти. Разом із підписом
 * зберігаємо докази: частково прихований e-mail, IP й пристрій. Пізніше сюди підключається Дія.Підпис як окремий спосіб.
 */
export type Signature = { at: Date; method: string; signatureId: string; email?: string; ip?: string; userAgent?: string };

/** Спосіб підписання: код з e-mail. `demo` лишився лише в договорах, підписаних до появи кодів */
export const SIGNING_METHOD_EMAIL_OTP = 'email_otp';
export const SIGNING_METHOD_DEMO = 'demo';

/**
 * Створює підпис сторони під договором із даним відбитком. Ідентифікатор підпису прив'язаний до відбитку договору,
 * сторони й часу, тож його не можна перенести на інший текст.
 */
export function signContract(input: { contractHash: string; userId: string; role: 'owner' | 'renter'; at?: Date; method?: string }): Signature {
  const at = input.at ?? new Date();
  const method = input.method ?? SIGNING_METHOD_EMAIL_OTP;
  const signatureId = createHash('sha256').update(`${input.contractHash}:${input.role}:${input.userId}:${at.toISOString()}:${method}`).digest('hex').slice(0, 16).toUpperCase();
  return { at, method, signatureId };
}

export const methodLabel = (method: string) => (method === SIGNING_METHOD_EMAIL_OTP ? 'підтвердження кодом з e-mail' : method === SIGNING_METHOD_DEMO ? 'підтвердження в застосунку' : method);
