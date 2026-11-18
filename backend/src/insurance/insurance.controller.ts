import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Put, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsIsoDay } from '../common/is-iso-day';
import { IsOptional } from 'class-validator';

import { type AuthUser, CurrentUser, Roles } from '../common/current-user';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import { MAX_POLICY_BYTES } from './insurance.files';
import { InsuranceService, type UploadedFile as Upload } from './insurance.service';

class ValidUntilDto {
  /** YYYY-MM-DD чи null, щоб прибрати дату */
  @IsOptional()
  @IsIsoDay()
  validUntil?: string | null;
}

@Controller('insurance/cars')
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  /** Чи є поліс і що про нього відомо (власнику авто й орендарю з орендою цього авто) */
  @Header('Cache-Control', 'no-store')
  @Get(':carId')
  info(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    return this.insurance.info(user, carId);
  }

  /** Завантажити файл полісу (PDF чи фото); новий замінює попередній. Поле форми `file`, необов'язково `validUntil` */
  @Roles('owner')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_POLICY_BYTES, files: 1 } }))
  @Put(':carId')
  upload(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string, @UploadedFile() file: Upload | undefined, @Body() body: { validUntil?: string }) {
    return this.insurance.upload(user, carId, file, body?.validUntil);
  }

  @Roles('owner')
  @Patch(':carId')
  setValidUntil(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string, @Body() dto: ValidUntilDto) {
    return this.insurance.setValidUntil(user, carId, dto.validUntil ?? null);
  }

  @Roles('owner')
  @HttpCode(204)
  @Delete(':carId')
  remove(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    return this.insurance.remove(user, carId);
  }

  /** Файл полісу для завантаження */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Get(':carId/file')
  async file(@CurrentUser() user: AuthUser, @Param('carId', ParseObjectIdPipe) carId: string) {
    const f = await this.insurance.download(user, carId);
    return new StreamableFile(f.data, { type: f.mime, disposition: `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }
}
