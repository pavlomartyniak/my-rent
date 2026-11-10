export const REPORT_KINDS = ['listing', 'user', 'message'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_REASONS = ['spam', 'fraud', 'inappropriate', 'fake', 'abuse', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'resolved'] as const;

/** Куди надходять сповіщення про скарги, якщо не задано MODERATION_EMAIL */
export const DEFAULT_MODERATION_EMAIL = 'kolo.rentapp@gmail.com';

export const SUSPENDED_MESSAGE = 'Акаунт призупинено через порушення правил. Якщо це помилка, напишіть на kolo.rentapp@gmail.com';

/** Як довго діє кеш списку призупинених акаунтів, мс */
export const SUSPENDED_CACHE_MS = 60_000;
