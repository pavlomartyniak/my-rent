import { rentalDays, totalPrice } from '../rentals/rentals.math';

/** Автоматичні платежі за договором: що власник отримав, а орендар заплатив у момент передачі авто */

export const CONTRACT_NOTE = (number: string) => `Автоматично за договором № ${number}`;

const MS_PER_DAY = 86_400_000;
const time = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();

/** Скільки діб оренди вже використано: до початку — 0, далі від початку до сьогодні (не більше ніж за договором) */
export function usedDays(startDate: string, endDate: string, today: string) {
  if (today <= startDate) return 0;
  const total = rentalDays(startDate, endDate);
  return Math.min(total, Math.max(1, Math.round((time(today) - time(startDate)) / MS_PER_DAY)));
}

/** Сума за весь строк договору: вона сплачується при передачі авто */
export const contractTotal = (pricePerDay: number, startDate: string, endDate: string) => totalPrice(pricePerDay, startDate, endDate);

/**
 * Сума до розрахунку при достроковому розірванні: плата за фактично використані доби. Якщо оренда ще не почалась,
 * нуль, тобто гроші повертаються й автоматичні записи прибираються.
 */
export function settledAmount(pricePerDay: number, startDate: string, endDate: string, today: string) {
  return Math.round(usedDays(startDate, endDate, today) * pricePerDay * 100) / 100;
}
