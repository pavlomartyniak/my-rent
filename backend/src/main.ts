import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { validationFactory } from './common/field-errors';
import { describeTarget, resolveAppEnv } from './config/env-files';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // За проксі хостингу (Render) беремо справжню IP клієнта з X-Forwarded-For, інакше ліміти запитів
  // рахувались би на всіх користувачів разом
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '2mb' });
  // whitelist відкидає невідомі поля, transform приводить типи до DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: validationFactory }));

  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  const appEnv = resolveAppEnv();
  Logger.log(`API запущено на порту ${port}. Середовище: ${appEnv}, ${describeTarget(process.env)}`, 'Bootstrap');
  // Локальний запуск проти бази проду небезпечний: будь-яка дія змінює справжні дані
  if (appEnv === 'production' && !process.env.RENDER) {
    Logger.warn('УВАГА: сервер запущено ЛОКАЛЬНО із налаштуваннями PRODUCTION. Усе, що ви робите, змінює справжні дані.', 'Bootstrap');
  }
}

void bootstrap();
