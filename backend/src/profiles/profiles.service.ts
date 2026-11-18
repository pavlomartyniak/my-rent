import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { profileBadges, type RatingSummary, summarize, tagsFor } from '../common/reviews';
import { dealStageOf } from '../deals/deal-stage';
import { ModerationService } from '../moderation/moderation.service';
import { fullName, maskedName, todayUtc } from '../rentals/rentals.math';
import { Car } from '../schemas/car.schema';
import { Deal } from '../schemas/deal.schema';
import { Offer } from '../schemas/offer.schema';
import { RentalRequest } from '../schemas/rental-request.schema';
import { Review } from '../schemas/review.schema';
import { User } from '../schemas/user.schema';
import type { CreateReviewDto } from './profiles.dto';

/** Повне ім'я у порядку «Прізвище Ім'я По батькові» */
const legalName = (u: { firstName: string; lastName: string; middleName?: string }) => [u.lastName, u.firstName, u.middleName].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(Deal.name) private readonly deals: Model<Deal>,
    @InjectModel(RentalRequest.name) private readonly rentals: Model<RentalRequest>,
    @InjectModel(Offer.name) private readonly offers: Model<Offer>,
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    private readonly moderation: ModerationService,
  ) {}

  /** Рейтинг користувача як власника й як орендаря разом: середнє по всіх оцінках, які він отримав */
  async ratingOf(userId: string): Promise<RatingSummary> {
    const rows = await this.reviews.find({ targetId: userId }, 'rating tags').lean().exec();
    return summarize(rows);
  }

  /**
   * Профіль для перегляду. Публічні лише ім'я з ініціалом, місто, рейтинг, статистика й вільні авто власника.
   * Повне ім'я, телефон і пошту бачить лише той, у кого з цією людиною є оренда. Профіль орендаря бачить лише той, з ким
   * у нього є запит, пропозиція чи оренда. Заблоковані одне одного профілів не бачать.
   */
  async profile(viewerId: string, targetId: string) {
    const target = await this.users.findById(targetId).lean().exec();
    if (!target || target.suspended) throw new NotFoundException('Профіль не знайдено');
    const self = viewerId === targetId;
    if (!self && (await this.moderation.isBlocked(viewerId, targetId))) throw new NotFoundException('Профіль недоступний');

    const pair = { $or: [{ ownerId: viewerId, renterId: targetId }, { ownerId: targetId, renterId: viewerId }] };
    const [connected, hasRequest, hasOffer] = self
      ? [true, true, true]
      : await Promise.all([this.deals.exists(pair).then(Boolean), this.rentals.exists(pair).then(Boolean), this.offers.exists(pair).then(Boolean)]);
    if (target.role === 'renter' && !(connected || hasRequest || hasOffer)) throw new NotFoundException('Профіль недоступний');

    const today = todayUtc();
    const [deals, rating, cars] = await Promise.all([
      this.deals.find({ $or: [{ ownerId: targetId }, { renterId: targetId }] }, 'status startDate endDate').lean().exec(),
      this.ratingOf(targetId),
      target.role === 'owner'
        ? this.cars.find({ userId: targetId, 'listing.published': true, status: 'Вільне', moderationHidden: { $ne: true } }).sort({ 'listing.publishedAt': -1 }).limit(20).lean().exec()
        : Promise.resolve([]),
    ]);
    const stages = deals.map((d) => dealStageOf(d, today));
    const completed = stages.filter((s) => s === 'finished').length;
    const since = (target as { createdAt?: Date }).createdAt;
    const badges = profileBadges({ completed, rating, joinedAt: since, now: new Date() });

    return {
      id: targetId,
      role: target.role,
      self,
      name: connected ? legalName(target) : maskedName(target.firstName, target.lastName),
      city: target.city || null,
      photoUri: target.photoUri || null,
      about: target.about || '',
      drivingSince: target.drivingSince ?? null,
      purposes: target.purposes ?? [],
      badges,
      memberSince: since ?? null,
      rating,
      stats: { completedDeals: completed, activeDeals: stages.filter((s) => s === 'active' || s === 'upcoming').length },
      // Контакти бачить лише сторона оренди (або сам власник профілю)
      contact: connected ? { phone: target.phone || null, email: target.email } : null,
      cars: cars.map((c) => ({
        id: String(c._id),
        title: `${c.brand} ${c.model}`,
        year: c.year,
        photoUri: (c.photoUri ?? '').startsWith('https://') ? c.photoUri : null,
        city: c.listing?.city ?? '',
        pricePerDay: c.listing?.pricePerDay ?? 0,
        deposit: c.listing?.deposit ?? 0,
      })),
    };
  }

  /** Чи може користувач оцінити другу сторону цієї оренди, кого саме і які теги доступні */
  async reviewState(userId: string, dealId: string) {
    const { deal, targetId, targetRole } = await this.dealParties(userId, dealId);
    const stage = dealStageOf(deal, todayUtc());
    const [target, mine] = await Promise.all([this.users.findById(targetId, 'firstName lastName middleName').lean().exec(), this.reviews.findOne({ dealId, authorId: userId }).lean().exec()]);
    const eligible = stage === 'finished' || stage === 'terminated';
    return {
      eligible: eligible && !mine,
      reason: mine ? 'Ви вже оцінили цю оренду' : eligible ? null : 'Оцінити можна після завершення чи розірвання оренди',
      target: { id: targetId, role: targetRole, name: target ? legalName(target) : 'Користувач видалений' },
      tags: tagsFor(targetRole),
      mine: mine ? { rating: mine.rating, tags: mine.tags } : null,
    };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    const state = await this.reviewState(userId, dto.dealId);
    if (state.mine) throw new ConflictException('Ви вже оцінили цю оренду');
    if (!state.eligible) throw new BadRequestException(state.reason ?? 'Оцінити зараз не можна');
    const allowed = tagsFor(state.target.role as 'owner' | 'renter');
    const tags = [...new Set(dto.tags)];
    if (tags.some((t) => !allowed.includes(t))) throw new BadRequestException('Невідомий тег оцінки');
    try {
      await this.reviews.create({ dealId: dto.dealId, authorId: userId, targetId: state.target.id, targetRole: state.target.role, rating: dto.rating, tags });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException('Ви вже оцінили цю оренду');
      throw e;
    }
    return this.reviewState(userId, dto.dealId);
  }

  private async dealParties(userId: string, dealId: string) {
    const deal = await this.deals.findById(dealId).lean().exec();
    const isOwner = !!deal && String(deal.ownerId) === userId;
    const isRenter = !!deal && String(deal.renterId) === userId;
    if (!deal || (!isOwner && !isRenter)) throw new NotFoundException('Оренду не знайдено');
    return { deal, targetId: String(isOwner ? deal.renterId : deal.ownerId), targetRole: (isOwner ? 'renter' : 'owner') as 'owner' | 'renter' };
  }
}
