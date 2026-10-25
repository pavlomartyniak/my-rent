import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module';
import { LifecycleService } from './lifecycle.service';

@Module({ imports: [ChatModule], providers: [LifecycleService] })
export class LifecycleModule {}
