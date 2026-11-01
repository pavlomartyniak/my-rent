import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CarsService } from '../cars/cars.service';
import { LISTING_PRICE_UAH } from '../common/constants';
import { PaymentOrder } from '../schemas/payment-order.schema';
import { CURRENCY, createInvoice, decideWebhook, hookReply, type Merchant, verifyHook, type WayForPayHook } from './wayforpay';

/** Скільки діє рахунок: за цей час неоплачене замовлення віддаємо вдруге замість нового */
const ORDER_TTL_SECONDS = 3600;
const REUSE_MS = (ORDER_TTL_SECONDS - 300) * 1000;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentOrder.name) private readonly orders: Model<PaymentOrder>,
    private readonly cars: CarsService,
    private readonly config: ConfigService,
  ) {}

  /** Дані магазину WayForPay із середовища; undefined, поки їх не задано */
  private get merchant(): Merchant | undefined {
    const account = this.config.get<string>('WAYFORPAY_MERCHANT_ACCOUNT');
    const secret = this.config.get<string>('WAYFORPAY_SECRET');
    const domain = this.config.get<string>('WAYFORPAY_DOMAIN');
    return account && secret && domain ? { account, secret, domain } : undefined;
  }

  /** Публічна адреса сервера для вебхука: своя змінна, інакше адреса, яку Render дає сам */
  private get baseUrl() {
    return (this.config.get<string>('PUBLIC_API_URL') ?? this.config.get<string>('RENDER_EXTERNAL_URL') ?? '').replace(/\/$/, '');
  }

  /**
   * Починає оплату публікації авто: повертає посилання на сторінку оплати WayForPay. Без налаштованого магазину працює лише
   * демо-режим: публікація відкривається одразу. Якщо платити не треба (місце безкоштовне чи вже оплачено), каже про це.
   */
  async startListingPayment(userId: string, carId: string) {
    if (!(await this.cars.listingNeedsPayment(userId, carId))) return { required: false as const };

    const merchant = this.merchant;
    if (!merchant) {
      if (this.config.get('DEMO_MODE') !== 'true') throw new ServiceUnavailableException('Оплату публікації ще не налаштовано');
      await this.cars.unlockListing(userId, carId);
      return { required: true as const, paid: true as const, demo: true as const };
    }
    if (!this.baseUrl) throw new ServiceUnavailableException('Не задано публічну адресу сервера для оплати');

    // Не плодимо рахунки: поки діє попередній неоплачений, віддаємо його
    const open = await this.orders.findOne({ userId, carId, status: 'created', pageUrl: { $exists: true }, createdAt: { $gt: new Date(Date.now() - REUSE_MS) } }).sort({ _id: -1 }).exec();
    if (open?.pageUrl) return { required: true as const, paid: false as const, orderId: String(open._id), pageUrl: open.pageUrl };

    const order = await this.orders.create({ userId, carId, amount: LISTING_PRICE_UAH, currency: CURRENCY });
    try {
      order.pageUrl = await createInvoice(merchant, {
        orderReference: String(order._id),
        amount: order.amount,
        productName: 'Публікація авто в Kolo',
        serviceUrl: `${this.baseUrl}/payments/wayforpay/webhook`,
        timeoutSeconds: ORDER_TTL_SECONDS,
      });
      await order.save();
      return { required: true as const, paid: false as const, orderId: String(order._id), pageUrl: order.pageUrl };
    } catch (e) {
      this.log.error(`Не вдалося створити рахунок: ${(e as Error).message}`);
      await order.deleteOne();
      throw new HttpException('Не вдалося створити рахунок на оплату. Спробуйте ще раз', HttpStatus.BAD_GATEWAY);
    }
  }

  /** Статус замовлення для застосунку: поки вебхук не прийшов, це `created` */
  async status(userId: string, orderId: string) {
    const order = await this.orders.findOne({ _id: orderId, userId }).exec();
    if (!order) throw new NotFoundException('Замовлення не знайдено');
    return { orderId: String(order._id), carId: String(order.carId), status: order.status };
  }

  /**
   * Вебхук WayForPay. Приймаємо лише з правильним підписом; знаходимо замовлення за `orderReference` і діємо за
   * `decideWebhook`. Повторні вебхуки безпечні. На будь-який підписаний вебхук відповідаємо «accept», бо інакше
   * WayForPay повторюватиме його до 4 діб.
   */
  async handleWebhook(hook: WayForPayHook | undefined) {
    const merchant = this.merchant;
    if (!merchant) throw new ServiceUnavailableException('Оплату не налаштовано');
    if (!hook || typeof hook !== 'object' || !hook.orderReference) throw new BadRequestException('Порожній вебхук');
    if (hook.merchantAccount !== merchant.account || !verifyHook(hook, merchant.secret)) throw new UnauthorizedException('Невірний підпис');

    const reference = String(hook.orderReference);
    const order = /^[a-f\d]{24}$/i.test(reference) ? await this.orders.findById(reference).exec() : null;
    if (!order) {
      this.log.warn(`Вебхук для невідомого замовлення ${reference}`);
      return hookReply(reference, merchant.secret);
    }

    const action = decideWebhook({ amount: order.amount, currency: order.currency, status: order.status }, hook);
    if (action === 'mismatch') this.log.error(`Сума не збігається: замовлення ${order._id} має ${order.amount} ${order.currency}, прийшло ${hook.amount} ${hook.currency}`);
    if (action === 'paid') {
      await this.orders.updateOne({ _id: order._id, status: { $ne: 'paid' } }, { $set: { status: 'paid', paidAt: new Date() } });
      // Відкриття публікації ідемпотентне: якщо воно впало, вебхук прийде знову й повторить
      await this.cars.unlockListing(String(order.userId), String(order.carId));
    } else if (action === 'failed' || action === 'reversed') {
      await this.orders.updateOne({ _id: order._id }, { $set: { status: action, failureReason: hook.reason } });
      if (action === 'reversed') this.log.warn(`Платіж за замовленням ${order._id} повернено: публікацію авто перевірте вручну`);
    }
    return hookReply(reference, merchant.secret);
  }
}
