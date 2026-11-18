import { router } from 'expo-router';

import type { RentPurpose } from './profile';

/** Відповіді ендпоінтів /users/:id/profile та /reviews */

export type RatingSummary = { count: number; avg: number | null; tags: { tag: string; count: number }[] };

export type ProfileCar = { id: string; title: string; year: number; photoUri: string | null; city: string; pricePerDay: number; deposit: number };

export type ProfileView = {
  id: string;
  role: 'owner' | 'renter';
  /** Це мій власний профіль */
  self: boolean;
  /** Повне ім'я для сторони оренди, інакше «Ім'я П.» */
  name: string;
  city: string | null;
  photoUri: string | null;
  about: string;
  /** Рік, з якого водить */
  drivingSince: number | null;
  purposes: RentPurpose[];
  licenseCategories: string[];
  accidents: string | null;
  rentExperience: string | null;
  occupations: string[];
  rentTerm: string | null;
  depositReady: string | null;
  transmission: string | null;
  replyTime: string | null;
  handovers: string[];
  hostingExperience: string | null;
  insurances: string[];
  serviceCare: string | null;
  mileageLimit: string | null;
  mileageKm: number | null;
  abroad: string | null;
  /** Позначки, виведені з фактів: новий, досвідчений, високий рейтинг */
  badges: { key: 'new' | 'experienced' | 'top'; title: string }[];
  memberSince: string | null;
  rating: RatingSummary;
  stats: { completedDeals: number; activeDeals: number };
  /** Телефон і пошта: лише для сторони оренди (і власнику профілю); інакше null */
  contact: { phone: string | null; email: string } | null;
  /** Вільні опубліковані авто (лише у власників) */
  cars: ProfileCar[];
};

export type ReviewState = {
  /** Можна оцінити зараз */
  eligible: boolean;
  reason: string | null;
  target: { id: string; role: 'owner' | 'renter'; name: string };
  /** Доступні теги для цієї оцінки */
  tags: string[];
  mine: { rating: number; tags: string[] } | null;
};

export const openProfile = (id: string) => router.push({ pathname: '/user/[id]', params: { id } });
