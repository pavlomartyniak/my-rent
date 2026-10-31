import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Post, StreamableFile } from '@nestjs/common';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { ConfirmPaymentDto, TerminateDealDto } from './deals.dto';
import { DealsService } from './deals.service';

/** Оренди орендаря: авто, які він взяв в оренду. Облік по них ведеться через /transactions і /reports/renter */
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  /** Пропозиції розірвати оренду від другої сторони, що чекають моєї відповіді (власнику й орендарю) */
  @Header('Cache-Control', 'no-store')
  @Get('termination-requests')
  termination(@CurrentUser() user: AuthUser) {
    return this.deals.awaitingMyAnswer(user);
  }

  @Roles('renter')
  @Header('Cache-Control', 'no-store')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.deals.list(user.id);
  }

  /** Власник: поточна оренда мого авто (орендар, дати, ціна) або null */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('car/:carId')
  async forCar(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    // Порожня відповідь віддається як null у тілі, щоб клієнт відрізняв її від помилки
    return (await this.deals.activeForCar(user.id, carId)) ?? { none: true };
  }

  /** Платежі, про які треба спитати мене: «ви сплатили?» (орендар) чи «ви отримали?» (власник) */
  @Header('Cache-Control', 'no-store')
  @Get('awaiting-payment')
  awaitingPayment(@CurrentUser() user: AuthUser) {
    return this.deals.awaitingPayment(user);
  }

  /** Підтвердити платіж: орендар — сплатив, власник — отримав; без суми — повністю, з сумою — частину */
  @HttpCode(200)
  @Post(':id/payments/:n/confirm')
  confirmPayment(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Param('n', ParseIntPipe) n: number, @Body() dto: ConfirmPaymentDto) {
    return this.deals.confirmPayment(user, id, n, dto.amount);
  }

  /** Підтвердити заставу: орендар — вніс, власник — отримав */
  @HttpCode(200)
  @Post(':id/deposit/confirm')
  confirmDeposit(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.confirmDeposit(user, id);
  }

  /** «Ще ні»: відкласти запитання про платіж до завтра */
  @HttpCode(200)
  @Post(':id/payments/:n/later')
  postponePayment(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Param('n', ParseIntPipe) n: number) {
    return this.deals.postponePayment(user, id, n);
  }

  /** Договори, які чекають мого підпису (власнику й орендарю) */
  @Header('Cache-Control', 'no-store')
  @Get('awaiting-signature')
  awaitingSignature(@CurrentUser() user: AuthUser) {
    return this.deals.awaitingSignature(user);
  }

  /** Текст договору, підписи сторін і відбиток умов */
  @Header('Cache-Control', 'no-store')
  @Get(':id/contract')
  contract(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.contract(user, id);
  }

  /** Договір у форматі PDF для завантаження */
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/pdf')
  @Get(':id/contract.pdf')
  async contractPdf(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    const { pdf, filename } = await this.deals.contractPdf(user, id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${filename}"` });
  }

  /** Підписати договір (поки підтвердженням у застосунку; далі BankID чи Дія.Підпис) */
  @HttpCode(200)
  @Post(':id/sign')
  sign(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.sign(user, id);
  }

  /** Скасувати домовленість до підписання договору */
  @HttpCode(200)
  @Post(':id/cancel-agreement')
  cancelAgreement(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.cancelAgreement(user, id);
  }

  /** Власник: усі поточні оренди (для секції «Оренди» на головній) */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.deals.currentForOwner(user.id);
  }

  /** Власник: оренди, що закінчились, а авто досі «В оренді»; застосунок пропонує звільнити його */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('awaiting-release')
  awaitingRelease(@CurrentUser() user: AuthUser) {
    return this.deals.awaitingRelease(user.id);
  }

  /** Власник підтверджує: оренда закінчилась, авто знову вільне */
  @Roles('owner')
  @HttpCode(204)
  @Post(':id/release')
  release(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.release(user.id, id);
  }

  /** Власник відповів «оренда триває»: більше не питати */
  @Roles('owner')
  @HttpCode(204)
  @Post(':id/keep')
  keep(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.keepRented(user.id, id);
  }

  /** Власник: завершені й розірвані оренди цього авто (архів) */
  @Roles('owner')
  @Header('Cache-Control', 'no-store')
  @Get('car/:carId/archive')
  archive(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    return this.deals.archiveForCar(user.id, carId);
  }

  /** Видалити архівну оренду зі свого списку (власник і орендар) */
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.hide(user, id);
  }

  @Header('Cache-Control', 'no-store')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.get(user, id);
  }

  /** Запропонувати розірвати оренду достроково: може і власник, і орендар, але друга сторона має погодитись */
  @HttpCode(200)
  @Post(':id/terminate')
  propose(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: TerminateDealDto) {
    return this.deals.proposeTermination(user, id, dto.note);
  }

  /** Автор відкликає свою пропозицію */
  @HttpCode(200)
  @Post(':id/terminate/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.withdrawTermination(user, id);
  }

  /** Друга сторона погоджується: оренду розірвано */
  @HttpCode(200)
  @Post(':id/terminate/accept')
  acceptTermination(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.acceptTermination(user, id);
  }

  /** Друга сторона відхиляє: оренда триває */
  @HttpCode(200)
  @Post(':id/terminate/decline')
  declineTermination(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.deals.declineTermination(user, id);
  }
}
