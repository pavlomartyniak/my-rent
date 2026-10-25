import { Global, Injectable, Module } from '@nestjs/common';

/** Що змінилось: застосунок оновлює відповідні списки. Дані по сокету не передаються, лише сигнал «перезавантаж». */
export type ChangeScope = 'rentals' | 'offers' | 'wanted' | 'deals' | 'cars';

type Emit = (userIds: string[], event: string, payload: unknown) => void;

/**
 * Сигнали про зміни для живого оновлення списків: запитів, пропозицій, заявок, оренд і авто. Сервіси лише називають, кому
 * і що змінилось, а канал (сокет) підключає ChatGateway. Якщо сокет недоступний, нічого не ламається: застосунок
 * оновить дані при поверненні на екран.
 */
@Injectable()
export class RealtimeService {
  private emit?: Emit;

  attach(emit: Emit) {
    this.emit = emit;
  }

  changed(userIds: unknown[], ...scopes: ChangeScope[]) {
    const ids = [...new Set(userIds.filter(Boolean).map(String))];
    if (ids.length && scopes.length) this.emit?.(ids, 'changed', { scopes });
  }
}

@Global()
@Module({ providers: [RealtimeService], exports: [RealtimeService] })
export class RealtimeModule {}
