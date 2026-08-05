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

const NO_CACHE: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
};

function parseBuildIdFromJson(body: string): string | null {
  if (!body || body.trimStart().startsWith("<")) return null;
  try {
    const data = JSON.parse(body) as Partial<AppVersionPayload>;
    return data.buildId?.trim() || null;
  } catch {
    return null;
  }
}

function parseBuildIdFromHtml(html: string): string | null {
  const match = html.match(
    /name=["']chatpool-build-id["']\s+content=["']([^"']+)["']/i
  );
  return match?.[1]?.trim() || null;
}

/** Build ID desplegado: version.json primero; si nginx no lo sirve, meta en index.html. */
export async function fetchDeployedBuildId(): Promise<string | null> {
  const bust = Date.now();

  try {
    const versionResponse = await fetch(`/version.json?build=${bust}`, NO_CACHE);
    if (versionResponse.ok) {
      const fromJson = parseBuildIdFromJson(await versionResponse.text());
      if (fromJson) return fromJson;
    }
  } catch {
    // fallback abajo
  }

  try {
    const indexResponse = await fetch(`/?build=${bust}`, NO_CACHE);
    if (!indexResponse.ok) return null;
    return parseBuildIdFromHtml(await indexResponse.text());
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
