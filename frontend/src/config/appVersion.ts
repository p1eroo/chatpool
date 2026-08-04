/** Inyectado en build por Vite (ver plugin chatpool-app-version). */
declare const __APP_BUILD_ID__: string;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

export interface AppVersionPayload {
  buildId: string;
  builtAt: string;
}

/** Disparado tras reconnect del WebSocket (p. ej. tras un deploy). */
export const APP_UPDATE_CHECK_EVENT = "chatpool:check-app-update";

/** Evita spam de /version.json por focus, reconnects, etc. */
export const APP_UPDATE_CHECK_MIN_INTERVAL_MS = 5 * 60 * 1000;

let lastCheckAt = 0;

export async function fetchDeployedBuildId(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?build=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) return null;

    const body = await response.text();
    if (!body || body.trimStart().startsWith("<")) return null;

    const data = JSON.parse(body) as Partial<AppVersionPayload>;
    return data.buildId?.trim() || null;
  } catch {
    return null;
  }
}

export function requestAppUpdateCheck(options?: { force?: boolean }) {
  const now = Date.now();
  if (!options?.force && now - lastCheckAt < APP_UPDATE_CHECK_MIN_INTERVAL_MS) {
    return;
  }
  lastCheckAt = now;
  window.dispatchEvent(new Event(APP_UPDATE_CHECK_EVENT));
}

/** Reserva el slot de throttle antes de un check directo (mount / visibility). */
export function tryClaimAppUpdateCheck(options?: { force?: boolean }): boolean {
  const now = Date.now();
  if (!options?.force && now - lastCheckAt < APP_UPDATE_CHECK_MIN_INTERVAL_MS) {
    return false;
  }
  lastCheckAt = now;
  return true;
}
