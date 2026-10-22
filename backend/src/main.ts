import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // За проксі хостингу (Render) беремо справжню IP клієнта з X-Forwarded-For, інакше ліміти запитів
  // рахувались би на всіх користувачів разом
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '2mb' });
  // whitelist відкидає невідомі поля, transform приводить типи до DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = app.get(ConfigService).get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`API запущено на порту ${port}`, 'Bootstrap');
}

void bootstrap();
