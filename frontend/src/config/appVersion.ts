/** Inyectado en build por Vite (ver plugin chatpool-app-version). */
declare const __APP_BUILD_ID__: string;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

export interface AppVersionPayload {
  buildId: string;
  builtAt: string;
}

export async function fetchDeployedVersion(): Promise<AppVersionPayload | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;
    return (await response.json()) as AppVersionPayload;
  } catch {
    return null;
  }
}
