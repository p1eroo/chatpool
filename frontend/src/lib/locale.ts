export const APP_LOCALE = "es-PE";
export const APP_TIMEZONE = "America/Lima";
export const APP_PHONE_PREFIX = "+51";

export function getDateKeyInAppTimezone(date: Date): string {
  return date.toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export const dateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
} as const;
