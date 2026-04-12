import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a 24h time string (e.g. "17:30:00" or "17:30") to 12h AM/PM format.
 * In Arabic, uses ص (صباحاً) and م (مساءً).
 */
export function formatTime12h(time: string | null | undefined, lang: string = 'en'): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return time;
  const isPM = h >= 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const suffix = lang === 'ar'
    ? (isPM ? 'م' : 'ص')
    : (isPM ? 'PM' : 'AM');
  return `${h12}:${m} ${suffix}`;
}
