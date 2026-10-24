import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { IsMongoId, IsOptional, Matches } from 'class-validator';
import type { Response } from 'express';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { ExportService } from './export.service';

class ExportQuery {
  /** Лише записи цього авто */
  @IsOptional()
  @IsMongoId()
  carId?: string;

  /** Місяць `2026-10` або рік `2026` */
  @IsOptional()
  @Matches(/^\d{4}(-\d{2})?$/, { message: 'Період має бути у форматі РРРР-ММ або РРРР' })
  period?: string;
}

@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Header('Cache-Control', 'no-store')
  @Get('transactions.csv')
  async transactions(@CurrentUser() user: AuthUser, @Query() query: ExportQuery, @Res({ passthrough: true }) res: Response) {
    const { csv, filename } = await this.exports.transactions(user.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // filename* — для назв із кирилицею; filename — запасний варіант лише з ASCII
    res.setHeader('Content-Disposition', `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return csv;
  }
}
