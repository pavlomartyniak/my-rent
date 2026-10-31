import { Controller, Get, Header, Query, Res, StreamableFile } from '@nestjs/common';
import { IsMongoId, IsOptional, Matches } from 'class-validator';
import type { Response } from 'express';

import { type AuthUser, CurrentUser } from '../common/current-user';
import { type ExportFormat, ExportService } from './export.service';

class ExportQuery {
  /** Лише записи цього авто (власник) */
  @IsOptional()
  @IsMongoId()
  carId?: string;

  /** Лише записи цієї оренди (орендар) */
  @IsOptional()
  @IsMongoId()
  dealId?: string;

  /** Місяць `2026-10`, рік `2026` або `all` — увесь час */
  @IsOptional()
  @Matches(/^(all|\d{4}(-\d{2})?)$/, { message: 'Період має бути у форматі РРРР-ММ, РРРР або all' })
  period?: string;
}

/** Вивантаження обліку для обох ролей: CSV, Excel і PDF */
@Controller('export')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Header('Cache-Control', 'no-store')
  @Get('transactions.csv')
  csv(@CurrentUser() user: AuthUser, @Query() query: ExportQuery, @Res({ passthrough: true }) res: Response) {
    return this.send(user, 'csv', query, res);
  }

  @Header('Cache-Control', 'no-store')
  @Get('transactions.xlsx')
  xlsx(@CurrentUser() user: AuthUser, @Query() query: ExportQuery, @Res({ passthrough: true }) res: Response) {
    return this.send(user, 'xlsx', query, res);
  }

  @Header('Cache-Control', 'no-store')
  @Get('transactions.pdf')
  pdf(@CurrentUser() user: AuthUser, @Query() query: ExportQuery, @Res({ passthrough: true }) res: Response) {
    return this.send(user, 'pdf', query, res);
  }

  private async send(user: AuthUser, format: ExportFormat, query: ExportQuery, res: Response) {
    const { body, contentType, filename } = await this.exports.file(user, format, query);
    res.setHeader('Content-Type', contentType);
    // filename* — для назв із кирилицею; filename — запасний варіант лише з ASCII
    res.setHeader('Content-Disposition', `attachment; filename="export.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return typeof body === 'string' ? body : new StreamableFile(body);
  }
}
