import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CarsModule } from './cars/cars.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { ChatModule } from './chat/chat.module';
import { CatalogModule } from './catalog/catalog.module';
import { DataModule } from './data/data.module';
import { DealsModule } from './deals/deals.module';
import { DatabaseModule } from './database/database.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health.controller';
import { MarketModule } from './market/market.module';
import { MediaModule } from './media/media.module';
import { RemindersModule } from './reminders/reminders.module';
import { RentalsModule } from './rentals/rentals.module';
import { ReportsModule } from './reports/reports.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { WantedModule } from './wanted/wanted.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        if (!env.MONGODB_URI) throw new Error('Не задано MONGODB_URI');
        if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) {
          throw new Error('JWT_SECRET має містити щонайменше 32 символи');
        }
        return env;
      },
    }),
    // Загальний ліміт: 120 запитів на хвилину з однієї IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DB') ?? 'my-rent',
      }),
    }),
    DatabaseModule,
    DealsModule,
    ChatModule,
    LifecycleModule,
    UsersModule,
    AuthModule,
    CarsModule,
    CatalogModule,
    TransactionsModule,
    RemindersModule,
    ReportsModule,
    ExportModule,
    MarketModule,
    RentalsModule,
    MediaModule,
    WantedModule,
    DataModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
