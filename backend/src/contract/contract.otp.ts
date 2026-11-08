import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** Одноразовий код підтвердження підпису: шість цифр на пошту, дійсний кілька хвилин, кілька спроб */
export const OTP_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
/** Як часто можна просити новий код */
export const OTP_RESEND_SECONDS = 60;

export type PendingCode = { hash: string; expiresAt: Date; attempts: number; sentAt: Date };

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Хеш коду прив'язаний до оренди, сторони й відбитку договору: код від одного договору не підійде до іншого */
export const hashCode = (code: string, dealId: string, role: string, contractHash: string) => createHash('sha256').update(`${dealId}:${role}:${contractHash}:${code}`).digest('hex');

export function codesMatch(code: string, hash: string, dealId: string, role: string, contractHash: string) {
  const a = Buffer.from(hashCode(code, dealId, role, contractHash), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CodeCheck = { ok: true } | { ok: false; reason: 'missing' | 'expired' | 'locked' | 'wrong'; attemptsLeft?: number };

/** Перевірка введеного коду. Не змінює стан: лічильник спроб збільшує викликач */
export function checkCode(pending: PendingCode | undefined, input: string, ctx: { dealId: string; role: string; contractHash: string }, now = new Date()): CodeCheck {
  if (!pending) return { ok: false, reason: 'missing' };
  if (pending.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (new Date(pending.expiresAt).getTime() < now.getTime()) return { ok: false, reason: 'expired' };
  if (!codesMatch(input, pending.hash, ctx.dealId, ctx.role, ctx.contractHash)) return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts - 1) };
  return { ok: true };
}

/** Скільки секунд лишилось до можливості запросити код знову; 0 — можна одразу */
export function resendWait(pending: PendingCode | undefined, now = new Date()) {
  if (!pending) return 0;
  const left = OTP_RESEND_SECONDS - (now.getTime() - new Date(pending.sentAt).getTime()) / 1000;
  return left > 0 ? Math.ceil(left) : 0;
}

/** m***@gmail.com: адреса, за якою видно, куди пішов код, але яку не розкрити другій стороні */
export function maskEmail(email: string) {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}
