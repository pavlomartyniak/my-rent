import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { DealsModule } from '../deals/deals.module';
import { LifecycleService } from './lifecycle.service';

@Module({ imports: [ChatModule, DealsModule], providers: [LifecycleService] })
export class LifecycleModule {}
