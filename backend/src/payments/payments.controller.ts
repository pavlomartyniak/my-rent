import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';

import { type AuthUser, CurrentUser, Public, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { PaymentsService } from './payments.service';
import type { WayForPayHook } from './wayforpay';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Власник: почати оплату публікації авто; віддає посилання на сторінку оплати */
  @Roles('owner')
  @HttpCode(200)
  @Post('listing/:carId')
  start(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    return this.payments.startListingPayment(user.id, carId);
  }

  /** Власник: статус замовлення (застосунок опитує його після оплати) */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('orders/:id')
  status(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.payments.status(user.id, id);
  }

  /** Вебхук WayForPay (serviceUrl): без авторизації користувача, захищений підписом на поля платежу. Відповідь теж підписана */
  @Public()
  @HttpCode(200)
  @Post('wayforpay/webhook')
  webhook(@Body() hook: WayForPayHook) {
    return this.payments.handleWebhook(hook);
  }
}
