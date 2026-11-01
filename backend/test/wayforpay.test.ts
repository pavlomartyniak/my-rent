import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { decideWebhook, hookReply, type OrderState, sign, verifyHook, type WayForPayHook } from '../src/payments/wayforpay';

const SECRET = 'test-secret-key';
const md5 = (s: string) => createHmac('md5', SECRET).update(s, 'utf8').digest('hex');

describe('підпис WayForPay', () => {
  it('HMAC_MD5 від полів через крапку з комою', () => assert.equal(sign(['a', 'b', 249, 'UAH'], SECRET), md5('a;b;249;UAH')));
  it('українські літери підписуються в UTF-8', () => assert.equal(sign(['Публікація авто'], SECRET), md5('Публікація авто')));
  it('інший ключ дає інший підпис', () => assert.notEqual(sign(['a'], 'other'), sign(['a'], SECRET)));
});

describe('вебхук WayForPay: підпис', () => {
  const base = { merchantAccount: 'shop_1', orderReference: '65f0c0ffee0123456789abcd', amount: 249, currency: 'UAH', authCode: '123456', cardPan: '41****1111', transactionStatus: 'Approved', reasonCode: 1100 };
  const signed = (over: Partial<WayForPayHook> = {}): WayForPayHook => {
    const hook = { ...base, ...over };
    return { ...hook, merchantSignature: md5([hook.merchantAccount, hook.orderReference, hook.amount, hook.currency, hook.authCode, hook.cardPan, hook.transactionStatus, hook.reasonCode].join(';')) };
  };

  it('правильний підпис проходить', () => assert.equal(verifyHook(signed(), SECRET), true));
  it('регістр hex-підпису не важливий', () => assert.equal(verifyHook({ ...signed(), merchantSignature: signed().merchantSignature!.toUpperCase() }, SECRET), true));
  it('змінена сума не проходить', () => assert.equal(verifyHook({ ...signed(), amount: 1 }, SECRET), false));
  it('змінений статус не проходить', () => assert.equal(verifyHook({ ...signed(), transactionStatus: 'Declined' }, SECRET), false));
  it('змінений номер замовлення не проходить', () => assert.equal(verifyHook({ ...signed(), orderReference: 'other' }, SECRET), false));
  it('підпис чужим ключем не проходить', () => assert.equal(verifyHook(signed(), 'other-secret'), false));
  it('без підпису чи зі сміттям не проходить і не падає', () => {
    assert.equal(verifyHook({ ...signed(), merchantSignature: undefined }, SECRET), false);
    assert.equal(verifyHook({ ...signed(), merchantSignature: 'zzz' }, SECRET), false);
    assert.equal(verifyHook({} as WayForPayHook, SECRET), false);
  });
});

describe('відповідь на вебхук', () => {
  it('підписує orderReference;status;time', () => {
    const reply = hookReply('ord-1', SECRET, 1415379863);
    assert.deepEqual(reply, { orderReference: 'ord-1', status: 'accept', time: 1415379863, signature: md5('ord-1;accept;1415379863') });
  });
});

describe('що робити з вебхуком', () => {
  const order: OrderState = { amount: 249, currency: 'UAH', status: 'created' };
  const hook = (over: Record<string, unknown>) => ({ transactionStatus: 'Approved', amount: 249, currency: 'UAH', ...over });

  it('успіх із правильною сумою відкриває публікацію', () => assert.equal(decideWebhook(order, hook({})), 'paid'));
  it('сума як рядок теж порівнюється числом', () => assert.equal(decideWebhook(order, hook({ amount: '249.00' })), 'paid'));
  it('повторний успіх для оплаченого замовлення знову дає paid (ідемпотентно)', () => assert.equal(decideWebhook({ ...order, status: 'paid' }, hook({})), 'paid'));
  it('копійки: 0,30 ₴ збігаються незалежно від запису числа', () => {
    const cheap: OrderState = { amount: 0.3, currency: 'UAH', status: 'created' };
    assert.equal(decideWebhook(cheap, hook({ amount: 0.3 })), 'paid');
    assert.equal(decideWebhook(cheap, hook({ amount: '0.30' })), 'paid');
    assert.equal(decideWebhook(cheap, hook({ amount: 249 })), 'mismatch');
  });
  it('підпис рахує суму з копійками так само, як її бачить WayForPay', () => assert.equal(sign(['x', 0.3, 'UAH'], SECRET), md5('x;0.3;UAH')));
  it('менша сума не відкриває публікацію', () => assert.equal(decideWebhook(order, hook({ amount: 1 })), 'mismatch'));
  it('інша валюта не відкриває публікацію', () => assert.equal(decideWebhook(order, hook({ currency: 'USD' })), 'mismatch'));
  it('відмова й закінчений строк позначають замовлення невдалим', () => {
    assert.equal(decideWebhook(order, hook({ transactionStatus: 'Declined' })), 'failed');
    assert.equal(decideWebhook(order, hook({ transactionStatus: 'Expired' })), 'failed');
  });
  it('запізніла відмова не скасовує оплачене замовлення', () => assert.equal(decideWebhook({ ...order, status: 'paid' }, hook({ transactionStatus: 'Declined' })), 'ignore'));
  it('повернення коштів за оплаченим замовленням', () => {
    assert.equal(decideWebhook({ ...order, status: 'paid' }, hook({ transactionStatus: 'Refunded' })), 'reversed');
    assert.equal(decideWebhook({ ...order, status: 'paid' }, hook({ transactionStatus: 'Voided' })), 'reversed');
  });
  it('повернення без оплати нічого не означає', () => assert.equal(decideWebhook(order, hook({ transactionStatus: 'Refunded' })), 'ignore'));
  it('проміжні й невідомі статуси ігноруються', () => {
    for (const transactionStatus of ['InProcessing', 'Pending', 'WaitingAuthComplete', 'Whatever', undefined]) assert.equal(decideWebhook(order, hook({ transactionStatus })), 'ignore');
  });
});
