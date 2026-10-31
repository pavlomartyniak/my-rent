import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { CreateCarDto, ListingDto, UpdateCarDto } from './cars.dto';
import { CarsService } from './cars.service';

@Roles('owner')
@Controller('cars')
export class CarsController {
  constructor(
    private readonly cars: CarsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.cars.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCarDto) {
    return this.cars.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.cars.get(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateCarDto) {
    return this.cars.update(user.id, id, dto);
  }

  /** Опублікувати оголошення про оренду (або оновити його) */
  @Put(':id/listing')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string, @Body() dto: ListingDto) {
    return this.cars.publish(user.id, id, dto);
  }

  /** Сплатити публікацію цього авто (разово). Поки оплату не підключено, це можливо лише в демо-режимі */
  @HttpCode(200)
  @Post(':id/listing/unlock')
  unlockListing(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    if (this.config.get('DEMO_MODE') !== 'true') throw new ForbiddenException('Оплату публікації ще не підключено');
    return this.cars.unlockListing(user.id, id);
  }

  /** Зняти оголошення з публікації */
  @Delete(':id/listing')
  unpublish(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.cars.unpublish(user.id, id);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseObjectIdPipe) id: string) {
    return this.cars.remove(user.id, id);
  }
}
