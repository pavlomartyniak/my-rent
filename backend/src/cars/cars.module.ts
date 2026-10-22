import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { CarsController } from './cars.controller';
import { CarsService } from './cars.service';

@Module({ imports: [UsersModule], controllers: [CarsController], providers: [CarsService] })
export class CarsModule {}
