import { AppError } from "../domain/errors.js";

/** Default si la bandeja no tiene configuración. */
export const DEFAULT_BOT_PAUSE_MINUTES = 15;

export const BOT_PAUSE_MINUTES_MIN = 1;
export const BOT_PAUSE_MINUTES_MAX = 1440;

export function clampBotPauseMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_BOT_PAUSE_MINUTES;
  return Math.min(
    BOT_PAUSE_MINUTES_MAX,
    Math.max(BOT_PAUSE_MINUTES_MIN, Math.floor(minutes))
  );
}

export function nextBotPausedUntil(
  from: Date = new Date(),
  minutes: number = DEFAULT_BOT_PAUSE_MINUTES
): Date {
  const ms = clampBotPauseMinutes(minutes) * 60 * 1000;
  return new Date(from.getTime() + ms);
}

export function isBotPaused(
  botPausedUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  return Boolean(botPausedUntil && botPausedUntil.getTime() > now.getTime());
}

export type ConversationBotStatus = "on" | "off";

/** `off` si `botPausedUntil` está en el futuro; si no, `on`. */
export function toBotStatus(
  botPausedUntil: Date | string | null | undefined,
  now: Date = new Date()
): ConversationBotStatus {
  const until =
    typeof botPausedUntil === "string" ? new Date(botPausedUntil) : botPausedUntil;
  return isBotPaused(until, now) ? "off" : "on";
}

/** Lanza 422 BOT_PAUSED si la conversación tiene el bot pausado. */
export function assertBotNotPaused(botPausedUntil: Date | null | undefined): void {
  if (!isBotPaused(botPausedUntil) || !botPausedUntil) return;

  const remainingMs = botPausedUntil.getTime() - Date.now();
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  throw new AppError(
    `El bot está pausado en esta conversación. Reintenta en ~${remainingMinutes} min.`,
    422,
    "BOT_PAUSED",
    {
      bot_paused_until: botPausedUntil.toISOString(),
      remaining_minutes: remainingMinutes,
    }
  );
}
