import { createHmac, timingSafeEqual } from 'node:crypto';

/** Робота з WayForPay: підпис HMAC_MD5, створення рахунку й рішення, що робити з вебхуком (https://wiki.wayforpay.com) */

const API = 'https://api.wayforpay.com/api';
export const CURRENCY = 'UAH';

/** HMAC_MD5 від полів, з'єднаних крапкою з комою, секретним ключем магазину: так підписуються і запити, і вебхуки */
export function sign(fields: (string | number)[], secret: string): string {
  return createHmac('md5', secret).update(fields.map(String).join(';'), 'utf8').digest('hex');
}

/** Порівняння підписів за сталий час, щоб за часом відповіді не добирали підпис */
function sameSignature(a: string, b: string) {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Вебхук (serviceUrl): поля, які нам потрібні */
export type WayForPayHook = {
  merchantAccount?: string;
  orderReference?: string;
  merchantSignature?: string;
  amount?: number | string;
  currency?: string;
  authCode?: string;
  cardPan?: string;
  transactionStatus?: string;
  reasonCode?: number | string;
  reason?: string;
};

/** Підпис вебхука: merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode */
export function verifyHook(hook: WayForPayHook, secret: string): boolean {
  if (!hook.merchantSignature) return false;
  const expected = sign([hook.merchantAccount ?? '', hook.orderReference ?? '', hook.amount ?? '', hook.currency ?? '', hook.authCode ?? '', hook.cardPan ?? '', hook.transactionStatus ?? '', hook.reasonCode ?? ''], secret);
  return sameSignature(expected, hook.merchantSignature);
}

/** Відповідь, яку WayForPay чекає на вебхук; без неї він повторює сповіщення до 4 діб */
export function hookReply(orderReference: string, secret: string, time = Math.floor(Date.now() / 1000)) {
  const status = 'accept';
  return { orderReference, status, time, signature: sign([orderReference, status, time], secret) };
}

export type OrderState = { amount: number; currency: string; status: string };
export type WebhookAction =
  /** Гроші отримано: відкриваємо публікацію (повторно теж безпечно) */
  | 'paid'
  | 'failed'
  | 'reversed'
  /** Сума чи валюта не збігаються із замовленням: нічого не відкриваємо */
  | 'mismatch'
  /** Проміжний чи невідомий статус */
  | 'ignore';

/**
 * Що робити з вебхуком для замовлення. Успіх (`Approved`) має збігатися із сумою й валютою замовлення. Оплачене замовлення
 * не повертаємо в «невдале» запізнілим вебхуком, а повернення коштів (`Refunded`, `Voided`) стосується лише оплаченого.
 */
export function decideWebhook(order: OrderState, hook: Pick<WayForPayHook, 'transactionStatus' | 'amount' | 'currency'>): WebhookAction {
  switch (hook.transactionStatus) {
    case 'Approved':
      return Number(hook.amount) === order.amount && (hook.currency ?? CURRENCY) === order.currency ? 'paid' : 'mismatch';
    case 'Declined':
    case 'Expired':
      return order.status === 'paid' ? 'ignore' : 'failed';
    case 'Refunded':
    case 'Voided':
      return order.status === 'paid' ? 'reversed' : 'ignore';
    default:
      return 'ignore';
  }
}

export type Merchant = { account: string; secret: string; domain: string };

/**
 * Створює рахунок (CREATE_INVOICE) і повертає посилання на сторінку оплати. Сума в гривнях. Підпис:
 * merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;назви;кількості;ціни.
 */
export async function createInvoice(
  merchant: Merchant,
  input: { orderReference: string; amount: number; productName: string; serviceUrl: string; timeoutSeconds: number },
): Promise<string> {
  const orderDate = Math.floor(Date.now() / 1000);
  const merchantSignature = sign([merchant.account, merchant.domain, input.orderReference, orderDate, input.amount, CURRENCY, input.productName, 1, input.amount], merchant.secret);
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'CREATE_INVOICE',
      merchantAccount: merchant.account,
      merchantAuthType: 'SimpleSignature',
      merchantDomainName: merchant.domain,
      merchantSignature,
      apiVersion: 1,
      language: 'UA',
      serviceUrl: input.serviceUrl,
      orderReference: input.orderReference,
      orderDate,
      orderTimeout: input.timeoutSeconds,
      amount: input.amount,
      currency: CURRENCY,
      productName: [input.productName],
      productCount: [1],
      productPrice: [input.amount],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { invoiceUrl?: string; reason?: string; reasonCode?: number | string } | null;
  if (!res.ok || !body?.invoiceUrl) throw new Error(`WayForPay: ${body?.reason ?? res.status} (${body?.reasonCode ?? '—'})`);
  return body.invoiceUrl;
}
