import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Connection, Model } from 'mongoose';

import type { AuthUser } from '../common/current-user';
import { renderContractPdf } from '../contract/contract.pdf';
import { signContract } from '../contract/contract.signing';
import { buildSections } from '../contract/contract.terms';
import { RealtimeService } from '../realtime/realtime.service';
import { settledAmount } from './deal-payments';
import { SIGN_DAYS_AFTER, signingState, signingWindow } from '../contract/contract.window';
import { fullName, todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { Transaction } from '../schemas/transaction.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Deal, type DealDocument } from '../schemas/deal.schema';
import { User } from '../schemas/user.schema';

type Person = { firstName: string; lastName: string; phone: string };

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Transaction.name) private readonly transactions: Model<Transaction>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectConnection() private readonly connection: Connection,
    private readonly realtime: RealtimeService,
  ) {}

  /** Усі оренди орендаря, новіші першими */
  async list(renterId: string) {
    const items = await this.deals.find({ renterId, hiddenFor: { $ne: 'renter' } }).sort({ createdAt: -1 }).limit(200).exec();
    const people = await this.people(items.map((d) => d.ownerId));
    return items.map((d) => this.view(d, 'renter', people));
  }

  async get(renterId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, renterId, hiddenFor: { $ne: 'renter' } }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return this.view(deal, 'renter', await this.people([deal.ownerId]));
  }

  /** Завершені чи розірвані оренди авто власника (архів) */
  async archiveForCar(ownerId: string, carId: string) {
    const items = await this.deals
      .find({ ownerId, carId, hiddenFor: { $ne: 'owner' }, $or: [{ status: 'terminated' }, { endDate: { $lt: todayUtc() } }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    const people = await this.people(items.map((d) => d.renterId));
    return items.map((d) => this.view(d, 'owner', people));
  }

  /**
   * Видалити архівну (завершену чи розірвану) оренду зі свого списку. Для орендаря разом з нею видаляються
   * його записи й аналітика по ній. Для другої сторони оренда лишається, а коли прибрали обидві, запис видаляється.
   */
  async hide(user: AuthUser, id: string) {
    const archived = { $or: [{ status: 'terminated' }, { endDate: { $lt: todayUtc() } }] };
    const deal = await this.deals
      .findOneAndUpdate({ _id: id, ...this.side(user), ...archived }, { $addToSet: { hiddenFor: user.role } }, { returnDocument: 'after', timestamps: false })
      .exec();
    if (!deal) {
      if (await this.deals.exists({ _id: id, ...this.side(user) })) throw new ConflictException('Видалити можна лише завершену чи розірвану оренду');
      throw new NotFoundException('Оренду не знайдено');
    }
    if (user.role === 'renter') await this.transactions.deleteMany({ userId: user.id, dealId: deal._id }).exec();
    if (deal.hiddenFor.includes('owner') && deal.hiddenFor.includes('renter')) await this.deals.deleteOne({ _id: deal._id }).exec();
  }

  /**
   * Оренди, що закінчились за датою, а авто в обліку власника досі «В оренді»: застосунок пропонує його звільнити.
   * Автоматично це не робиться, бо власник міг продовжити оренду без застосунку.
   */
  async awaitingRelease(ownerId: string) {
    const today = todayUtc();
    const ended = await this.deals
      .find({ ownerId, status: { $ne: 'terminated' }, endDate: { $lt: today }, releaseDismissed: { $ne: true } })
      .sort({ endDate: -1 })
      .limit(50)
      .exec();
    if (!ended.length) return [];
    const carIds = [...new Set(ended.map((d) => String(d.carId)))];
    const [cars, running] = await Promise.all([
      this.cars.find({ _id: { $in: carIds }, userId: ownerId, status: 'В оренді' }, '_id').lean().exec(),
      // Якщо на це авто вже є інша діюча оренда, підказувати нічого
      this.deals.find({ ownerId, carId: { $in: carIds }, status: { $ne: 'terminated' }, endDate: { $gte: today } }, 'carId').lean().exec(),
    ]);
    const rented = new Set(cars.map((c) => String(c._id)));
    const busy = new Set(running.map((d) => String(d.carId)));
    const seen = new Set<string>();
    const items = ended.filter((d) => {
      const car = String(d.carId);
      if (!rented.has(car) || busy.has(car) || seen.has(car)) return false;
      seen.add(car);
      return true;
    });
    const people = await this.people(items.map((d) => d.renterId));
    return items.map((d) => this.view(d, 'owner', people));
  }

  /** Власник підтверджує: оренда закінчилась, авто знову вільне */
  async release(ownerId: string, id: string) {
    const deal = await this.deals.findOne({ _id: id, ownerId }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    if (deal.status !== 'terminated' && todayUtc() <= deal.endDate) throw new ConflictException('Оренда ще триває');
    const car = await this.cars.findOne({ _id: deal.carId, userId: ownerId }).exec();
    if (car && car.status === 'В оренді') {
      car.status = 'Вільне';
      car.driver = '';
      await car.save();
    }
  }

  /** «Оренда триває»: більше не питати про цю оренду */
  async keepRented(ownerId: string, id: string) {
    const res = await this.deals.updateOne({ _id: id, ownerId }, { $set: { releaseDismissed: true } }, { timestamps: false }).exec();
    if (!res.matchedCount) throw new NotFoundException('Оренду не знайдено');
  }

  /** Оренди, де друга сторона запропонувала розірвати угоду й чекає моєї відповіді */
  async awaitingMyAnswer(user: AuthUser) {
    const other = user.role === 'renter' ? 'owner' : 'renter';
    const items = await this.deals
      .find({ ...this.side(user), status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() }, 'terminationRequest.by': other })
      .sort({ 'terminationRequest.at': -1 })
      .limit(50)
      .exec();
    const as = user.role === 'renter' ? 'renter' : 'owner';
    const people = await this.people(items.map((d) => (as === 'renter' ? d.ownerId : d.renterId)));
    return items.map((d) => this.view(d, as, people));
  }

  /** Усі поточні оренди власника: чекають підписання, ще не почались чи тривають (для секції «Оренди» на головній) */
  async currentForOwner(ownerId: string) {
    const items = await this.deals
      .find({ ownerId, hiddenFor: { $ne: 'owner' }, status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() } })
      .sort({ startDate: 1 })
      .limit(100)
      .exec();
    const people = await this.people(items.map((d) => d.renterId));
    return items.map((d) => this.view(d, 'owner', people));
  }

  /** Поточна оренда авто власника (діє чи ще не почалась); null — авто не здано через застосунок */
  async activeForCar(ownerId: string, carId: string) {
    const deal = await this.deals.findOne({ ownerId, carId, hiddenFor: { $ne: 'owner' }, status: { $ne: 'terminated' }, endDate: { $gte: todayUtc() } }).sort({ createdAt: -1 }).exec();
    if (!deal) return null;
    return this.view(deal, 'owner', await this.people([deal.renterId]));
  }

  /**
   * Дострокове розірвання потребує згоди обох сторін: одна пропонує, друга погоджується чи відхиляє.
   * Після згоди оренда закінчується сьогодні (чи в день початку, якщо ще не почалась), а авто в обліку
   * власника знову стає вільним. Записи й платежі лишаються для розрахунку.
   */
  async proposeTermination(user: AuthUser, id: string, note = '') {
    const deal = await this.mine(user, id);
    this.assertOpen(deal);
    if (deal.status === 'awaiting') throw new ConflictException('Договір ще не підписано: скасуйте домовленість замість розірвання');
    if (deal.terminationRequest) throw new ConflictException('Пропозицію про розірвання вже надіслано');
    deal.terminationRequest = { by: user.role, at: new Date(), note: note.trim() };
    await deal.save();
    this.pingOther(user, deal);
    return this.viewFor(user, deal);
  }

  /** Автор пропозиції відкликає її */
  async withdrawTermination(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    if (deal.terminationRequest?.by !== user.role) throw new ConflictException('Немає вашої пропозиції про розірвання');
    deal.terminationRequest = undefined;
    await deal.save();
    this.pingOther(user, deal);
    return this.viewFor(user, deal);
  }

  /** Друга сторона відхиляє пропозицію: оренда триває */
  async declineTermination(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    if (!deal.terminationRequest || deal.terminationRequest.by === user.role) throw new ConflictException('Немає пропозиції для відповіді');
    deal.terminationRequest = undefined;
    await deal.save();
    this.pingOther(user, deal);
    return this.viewFor(user, deal);
  }

  /** Друга сторона погоджується: оренду розірвано */
  async acceptTermination(user: AuthUser, id: string) {
    const session = await this.connection.startSession();
    let result: DealDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const deal = await this.deals.findOne({ _id: id, ...this.side(user) }, null, { session }).exec();
        if (!deal) throw new NotFoundException('Оренду не знайдено');
        this.assertOpen(deal);
        const proposal = deal.terminationRequest;
        if (!proposal || proposal.by === user.role) throw new ConflictException('Немає пропозиції для відповіді');
        deal.terminationRequest = undefined;
        await this.close(deal, proposal.by as 'owner' | 'renter', proposal.note ?? '', 'Оренду розірвано за згодою сторін', session);
        result = deal;
      });
    } finally {
      await session.endSession();
    }
    this.pingBoth(result as unknown as DealDocument, 'rentals', 'offers', 'wanted');
    return this.viewFor(user, result as unknown as DealDocument);
  }

  /**
   * Закриває оренду: статус «розірвано», кінець — сьогодні (чи день початку, якщо ще не почалась), авто знову вільне,
   * прийнятий запит чи пропозиція завершуються. Те саме для розірвання за згодою, скасування до підписання й
   * автоматичного скасування непідписаного договору.
   */
  private async close(deal: DealDocument, by: 'owner' | 'renter' | 'system', note: string, reason: string, session?: ClientSession) {
    // Майбутні платежі, за які нічого не підтверджено, скасовуються разом з орендою
    this.cancelFuturePayments(deal);
    const today = todayUtc();
    deal.status = 'terminated';
    deal.terminatedBy = by;
    deal.terminatedAt = new Date();
    deal.terminationNote = note;
    deal.endDate = today > deal.startDate ? today : deal.startDate;
    await deal.save({ session });

    const car = await this.cars.findOne({ _id: deal.carId, userId: deal.ownerId }, null, { session }).exec();
    if (car && (car.status === 'В оренді' || car.status === 'Заброньоване')) {
      car.status = 'Вільне';
      car.driver = '';
      await car.save({ session });
    }
    // Прийнятий запит чи пропозиція завершується разом з орендою: інакше вони б «висіли» як прийняті,
    // а орендар не зміг би знову звернутись щодо цього авто
    const ended = { $set: { status: 'ended', decisionNote: reason, respondedAt: new Date() } };
    if (deal.source === 'request') await this.rentals.updateOne({ _id: deal.sourceId, status: 'accepted' }, ended, { session });
    else await this.offers.updateOne({ _id: deal.sourceId, status: 'accepted' }, ended, { session });
  }

  // ---- договір ----

  /** Текст договору, підписи й відбиток умов для екрана */
  async contract(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    const c = this.requireContract(deal);
    return {
      dealId: String(deal._id),
      number: c.terms.number,
      createdAt: c.terms.createdAt,
      hash: c.hash,
      terms: c.terms,
      sections: buildSections(c.terms),
      signatures: this.signaturesView(deal),
      status: deal.status,
      signedAt: c.signedAt ?? null,
      mySigned: !!c.signatures?.[user.role],
      signing: this.signingView(deal.startDate),
    };
  }

  /** PDF договору: ті самі умови й підписи, що в застосунку */
  async contractPdf(user: AuthUser, id: string) {
    const deal = await this.mine(user, id);
    const c = this.requireContract(deal);
    const pdf = await renderContractPdf(c.terms, c.hash, { owner: c.signatures?.owner ?? null, renter: c.signatures?.renter ?? null });
    return { pdf, filename: `${c.terms.number}.pdf` };
  }

  /**
   * Підпис договору стороною. Зараз це підтвердження в застосунку; пізніше тут підключається BankID чи Дія.Підпис.
   * Коли підписали обидві сторони, оренда активується: авто стає «В оренді» (чи лишається «Заброньованим» до дати початку).
   */
  async sign(user: AuthUser, id: string) {
    const session = await this.connection.startSession();
    let result: DealDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const deal = await this.deals.findOne({ _id: id, ...this.side(user) }, null, { session }).exec();
        if (!deal) throw new NotFoundException('Оренду не знайдено');
        const c = this.requireContract(deal);
        if (deal.status !== 'awaiting') throw new ConflictException(deal.status === 'terminated' ? 'Домовленість скасована' : 'Договір уже підписано обома сторонами');
        const state = signingState(todayUtc(), deal.startDate);
        if (state === 'early') {
          throw new ConflictException(`Підписання відкриється ${signingWindow(deal.startDate).opensAt.split('-').reverse().join('.')}: підписуйте договір під час зустрічі, коли передаєте авто, ключі й гроші`);
        }
        if (state === 'late') throw new ConflictException('Час на підписання минув. Домовтесь про нову оренду');
        // Порожній об'єкт Mongoose не зберігає, тож створюємо його, коли підписує перший
        c.signatures ??= {};
        if (c.signatures[user.role]) throw new ConflictException('Ви вже підписали цей договір');

        c.signatures[user.role] = signContract({ contractHash: c.hash, userId: user.id, role: user.role });
        if (c.signatures.owner && c.signatures.renter) {
          deal.status = 'active';
          c.signedAt = new Date();
          const car = await this.cars.findOne({ _id: deal.carId, userId: deal.ownerId }, null, { session }).exec();
          if (car && car.status === 'Заброньоване') {
            if (todayUtc() >= deal.startDate) car.status = 'В оренді';
            await car.save({ session });
          }
        }
        deal.markModified('contract');
        await deal.save({ session });
        result = deal;
      });
    } finally {
      await session.endSession();
    }
    this.pingOther(user, result as unknown as DealDocument);
    if ((result as unknown as DealDocument).status === 'active') this.pingBoth(result as unknown as DealDocument);
    return this.viewFor(user, result as unknown as DealDocument);
  }

  // ---- платежі за договором ----

  /**
   * Підтвердження платежу своєю стороною: орендар — «я сплатив», власник — «я отримав». Сума за замовчуванням повна,
   * можна вказати частину. Облік (витрата в орендаря, дохід у власника) створюється чи оновлюється саме за цією відповіддю.
   */
  async confirmPayment(user: AuthUser, id: string, n: number, amount?: number) {
    const session = await this.connection.startSession();
    let result: DealDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const deal = await this.deals.findOne({ _id: id, ...this.side(user) }, null, { session }).exec();
        if (!deal) throw new NotFoundException('Оренду не знайдено');
        const c = this.requireContract(deal);
        if (deal.status !== 'active') throw new ConflictException('Платежі підтверджуються після підписання договору');
        const plan = c.terms.payments?.find((p) => p.n === n);
        const state = deal.payments?.find((p) => p.n === n);
        if (!plan || !state) throw new NotFoundException('Платіж не знайдено');
        if (state.cancelled) throw new ConflictException('Цей платіж скасовано');
        if (!this.isAvailable(plan, state)) throw new ConflictException('Строк цього платежу ще не настав');

        const confirmed = Math.round((amount ?? plan.amount) * 100) / 100;
        if (!(confirmed > 0) || confirmed > plan.amount) throw new ConflictException(`Сума має бути більшою за нуль і не більшою за ${plan.amount}`);

        if (user.role === 'renter') {
          state.renterPaid = confirmed;
          state.renterLaterUntil = undefined;
        } else {
          state.ownerReceived = confirmed;
          state.ownerLaterUntil = undefined;
        }
        deal.markModified('payments');
        await deal.save({ session });

        const count = c.terms.payments.length;
        const mine = user.role === 'renter';
        const filter = { userId: user.id, dealId: deal._id, paymentN: n, auto: 'contract' };
        const note = `Платіж ${n} з ${count} за договором № ${c.terms.number}`;
        const existing = await this.transactions.findOne(filter, null, { session }).exec();
        if (existing) {
          existing.amount = confirmed;
          await existing.save({ session });
        } else {
          await this.transactions.create(
            [
              {
                ...filter,
                carId: deal.carId,
                type: mine ? 'expense' : 'income',
                amount: confirmed,
                date: todayUtc(),
                category: mine ? 'Оренда авто' : 'Оренда',
                driver: mine ? '' : c.terms.renter.name,
                note,
              },
            ],
            { session },
          );
        }
        result = deal;
      });
    } finally {
      await session.endSession();
    }
    this.pingOther(user, result as unknown as DealDocument);
    return this.viewFor(user, result as unknown as DealDocument);
  }

  /** «Ще ні»: не питати про цей платіж до завтра */
  async postponePayment(user: AuthUser, id: string, n: number) {
    const deal = await this.mine(user, id);
    const state = deal.payments?.find((p) => p.n === n);
    if (!state) throw new NotFoundException('Платіж не знайдено');
    if (user.role === 'renter') state.renterLaterUntil = todayUtc();
    else state.ownerLaterUntil = todayUtc();
    deal.markModified('payments');
    await deal.save();
    return this.viewFor(user, deal);
  }

  /** Платежі, про які треба спитати цього користувача: строк настав (перший — одразу після підписання), підтверджено не все */
  async awaitingPayment(user: AuthUser) {
    const today = todayUtc();
    const items = await this.deals.find({ ...this.side(user), status: 'active', 'contract.signedAt': { $exists: true } }).limit(50).exec();
    const as = user.role === 'renter' ? 'renter' : 'owner';
    const people = await this.people(items.map((d) => (as === 'renter' ? d.ownerId : d.renterId)));
    const out: Record<string, unknown>[] = [];
    for (const d of items) {
      const name = this.view(d, as, people).counterpart.name;
      for (const p of this.paymentsView(d, as, today)) {
        if (!p.available || p.cancelled || p.remaining <= 0 || p.snoozed) continue;
        out.push({ dealId: String(d._id), title: d.title, counterpart: name, count: d.contract!.terms.payments.length, ...p });
      }
    }
    return out;
  }

  private isAvailable(plan: { n: number; dueDate: string }, _state: unknown) {
    // Перший платіж доступний одразу після підписання (гроші передаються під час зустрічі), наступні — з їхнього строку
    return plan.n === 1 || plan.dueDate <= todayUtc();
  }

  private cancelFuturePayments(deal: DealDocument) {
    const today = todayUtc();
    const plan = deal.contract?.terms.payments ?? [];
    let changed = false;
    for (const st of deal.payments ?? []) {
      const due = plan.find((p) => p.n === st.n)?.dueDate ?? today;
      if (due > today && !st.renterPaid && !st.ownerReceived && !st.cancelled) {
        st.cancelled = true;
        changed = true;
      }
    }
    if (changed) deal.markModified('payments');
  }

  /** Платежі для екрана: графік з відповідями обох сторін, розбіжності й що можна підтвердити зараз */
  private paymentsView(d: DealDocument, as: 'renter' | 'owner', today = todayUtc()) {
    const plan = d.contract?.terms.payments ?? [];
    return plan.map((p) => {
      const st = d.payments?.find((x) => x.n === p.n);
      const mine = (as === 'renter' ? st?.renterPaid : st?.ownerReceived) ?? 0;
      const other = (as === 'renter' ? st?.ownerReceived : st?.renterPaid) ?? 0;
      const later = as === 'renter' ? st?.renterLaterUntil : st?.ownerLaterUntil;
      return {
        n: p.n,
        dueDate: p.dueDate,
        days: p.days,
        amount: p.amount,
        mine,
        other,
        remaining: Math.round((p.amount - mine) * 100) / 100,
        available: d.status === 'active' && !!d.contract?.signedAt && (p.n === 1 || p.dueDate <= today),
        cancelled: !!st?.cancelled,
        snoozed: later === today,
        /** Обидві сторони відповіли, але суми різні */
        mismatch: mine > 0 && other > 0 && mine !== other,
      };
    });
  }

  /** Розрахунок після розірвання: що належить за використані доби, скільки сплатив орендар і отримав власник */
  private settlementView(d: DealDocument) {
    const c = d.contract;
    if (d.status !== 'terminated' || !c?.signedAt) return null;
    const used = settledAmount(c.terms.pricePerDay, c.terms.startDate, c.terms.endDate, (d.terminatedAt ?? new Date()).toISOString().slice(0, 10));
    const paid = (d.payments ?? []).reduce((s, p) => s + (p.renterPaid ?? 0), 0);
    const received = (d.payments ?? []).reduce((s, p) => s + (p.ownerReceived ?? 0), 0);
    return { due: used, paid: Math.round(paid * 100) / 100, received: Math.round(received * 100) / 100 };
  }

  /** До підписання кожна сторона може скасувати домовленість: авто знову вільне, запит завершується */
  async cancelAgreement(user: AuthUser, id: string) {
    const session = await this.connection.startSession();
    let result: DealDocument | null = null;
    try {
      await session.withTransaction(async () => {
        const deal = await this.deals.findOne({ _id: id, ...this.side(user) }, null, { session }).exec();
        if (!deal) throw new NotFoundException('Оренду не знайдено');
        if (deal.status !== 'awaiting') throw new ConflictException('Договір уже підписано: оренду можна лише розірвати за згодою сторін');
        await this.close(deal, user.role, '', 'Домовленість скасовано до підписання договору', session);
        result = deal;
      });
    } finally {
      await session.endSession();
    }
    this.pingBoth(result as unknown as DealDocument, 'rentals', 'offers', 'wanted');
    return this.viewFor(user, result as unknown as DealDocument);
  }

  /** Договори, які чекають підпису цього користувача (для банера й лічильника) */
  async awaitingSignature(user: AuthUser) {
    const items = await this.deals
      .find({ ...this.side(user), status: 'awaiting', [`contract.signatures.${user.role}`]: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    const as = user.role === 'renter' ? 'renter' : 'owner';
    const people = await this.people(items.map((d) => (as === 'renter' ? d.ownerId : d.renterId)));
    return items.map((d) => this.view(d, as, people));
  }

  /** Непідписані договори, у яких оренда мала початись, скасовуються: авто знову вільне */
  async expireUnsigned() {
    // Підписання відкрите ще SIGN_DAYS_AFTER діб після початку оренди; далі договір скасовується
    const cutoff = new Date(Date.now() - SIGN_DAYS_AFTER * 86_400_000).toISOString().slice(0, 10);
    const stale = await this.deals.find({ status: 'awaiting', startDate: { $lt: cutoff } }).limit(200).exec();
    for (const deal of stale) {
      await this.close(deal, 'system', '', 'Договір не підписано до початку оренди');
      this.pingBoth(deal, 'rentals', 'offers', 'wanted');
    }
    return stale.length;
  }

  /** Авто, чия оренда з підписаним договором уже почалась, стають «В оренді» (до того вони «Заброньовані») */
  async startReserved() {
    const started = await this.deals.find({ status: 'active', startDate: { $lte: todayUtc() }, endDate: { $gte: todayUtc() } }, 'carId ownerId').limit(500).lean().exec();
    if (!started.length) return 0;
    let n = 0;
    for (const d of started) {
      const res = await this.cars.updateOne({ _id: d.carId, userId: d.ownerId, status: 'Заброньоване' }, { $set: { status: 'В оренді' } });
      n += res.modifiedCount;
      if (res.modifiedCount) this.realtime.changed([d.ownerId], 'cars', 'deals');
    }
    return n;
  }

  /** Коли можна підписувати: за добу до початку оренди й кілька діб після; `open` — прямо зараз */
  private signingView(startDate: string) {
    const w = signingWindow(startDate);
    return { opensAt: w.opensAt, closesAt: w.closesAt, state: signingState(todayUtc(), startDate) };
  }

  private requireContract(deal: DealDocument) {
    if (!deal.contract) throw new NotFoundException('Для цієї оренди договір не створювався: її укладено до появи договорів');
    return deal.contract;
  }

  private signaturesView(deal: DealDocument) {
    const s = deal.contract?.signatures ?? {};
    const one = (v?: { at: Date; method: string; signatureId: string }) => (v ? { at: v.at, method: v.method, signatureId: v.signatureId } : null);
    return { owner: one(s.owner), renter: one(s.renter) };
  }

  /** Друга сторона оренди бачить зміну одразу */
  private pingOther(user: AuthUser, deal: DealDocument, ...extra: ('rentals' | 'offers' | 'wanted' | 'cars')[]) {
    this.realtime.changed([user.role === 'renter' ? deal.ownerId : deal.renterId], 'deals', ...extra);
  }

  /** Обидві сторони; авто власника змінило статус */
  private pingBoth(deal: DealDocument, ...extra: ('rentals' | 'offers' | 'wanted')[]) {
    this.realtime.changed([deal.ownerId, deal.renterId], 'deals', ...extra);
    this.realtime.changed([deal.ownerId], 'cars');
  }

  private side(user: AuthUser) {
    return user.role === 'renter' ? { renterId: user.id } : { ownerId: user.id };
  }

  private async mine(user: AuthUser, id: string) {
    const deal = await this.deals.findOne({ _id: id, ...this.side(user) }).exec();
    if (!deal) throw new NotFoundException('Оренду не знайдено');
    return deal;
  }

  private assertOpen(deal: DealDocument) {
    if (deal.status === 'terminated') throw new ConflictException('Оренду вже розірвано');
    if (todayUtc() > deal.endDate) throw new ConflictException('Оренду вже завершено');
  }

  private async viewFor(user: AuthUser, d: DealDocument) {
    const as = user.role === 'renter' ? 'renter' : 'owner';
    return this.view(d, as, await this.people([as === 'renter' ? d.ownerId : d.renterId]));
  }

  private async people(ids: DealDocument['ownerId'][]) {
    const unique = [...new Set(ids.map(String))];
    const users = await this.users.find({ _id: { $in: unique } }, 'firstName lastName phone').lean().exec();
    return new Map<string, Person>(users.map((u) => [String(u._id), u]));
  }

  /** Контакти співрозмовника відкриті: оренда вже підтверджена обома сторонами */
  private view(d: DealDocument, as: 'renter' | 'owner', people: Map<string, Person>) {
    const p = people.get(String(as === 'renter' ? d.ownerId : d.renterId));
    const fallback = as === 'renter' ? 'Власник' : 'Орендар';
    return {
      id: String(d._id),
      carId: String(d.carId),
      title: d.title,
      photoUri: d.photoUri,
      city: d.city,
      pricePerDay: d.pricePerDay,
      startDate: d.startDate,
      endDate: d.endDate,
      source: d.source,
      status: d.status ?? 'active',
      /** Договір: номер і хто підписав (null — оренда без договору, створена до його появи) */
      contract: d.contract
        ? { number: d.contract.terms.number, signed: { owner: !!d.contract.signatures?.owner, renter: !!d.contract.signatures?.renter }, mySigned: !!d.contract.signatures?.[as], signedAt: d.contract.signedAt ?? null, signing: this.signingView(d.startDate) }
        : null,
      /** План оплати й графік платежів із відповідями сторін (для оренд з договором) */
      paymentPlan: d.contract?.terms.paymentPlan ?? null,
      payments: d.contract ? this.paymentsView(d, as) : [],
      settlement: this.settlementView(d),
      // Пропозиція про розірвання, що чекає відповіді; `mine` — чи її подав автор запиту
      terminationRequest: d.terminationRequest ? { by: d.terminationRequest.by, at: d.terminationRequest.at, note: d.terminationRequest.note ?? '', mine: d.terminationRequest.by === as } : null,
      terminatedBy: d.terminatedBy,
      terminatedAt: d.terminatedAt,
      terminationNote: d.terminationNote ?? '',
      // Для орендаря це власник, для власника — орендар
      // Номер телефону віддається лише в чаті
      counterpart: { name: p ? fullName(p.firstName, p.lastName) || fallback : fallback },
      createdAt: d.createdAt,
    };
  }
}
