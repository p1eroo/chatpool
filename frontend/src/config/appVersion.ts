/** Inyectado en build por Vite (ver plugin chatpool-app-version). */
declare const __APP_BUILD_ID__: string;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";

export interface AppVersionPayload {
  buildId: string;
  builtAt: string;
}

const BUILD_META_PATTERN =
  /<meta\s+name=["']chatpool-build-id["']\s+content=["']([^"']+)["']/i;

function parseBuildIdFromHtml(html: string): string | null {
  const match = html.match(BUILD_META_PATTERN);
  return match?.[1]?.trim() || null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchBuildIdFromVersionJson(): Promise<string | null> {
  const body = await fetchText(`/version.json?build=${Date.now()}`);
  if (!body || body.trimStart().startsWith("<")) return null;

  try {
    const data = JSON.parse(body) as Partial<AppVersionPayload>;
    return data.buildId?.trim() || null;
  } catch {
    return null;
  }
}

/** Fallback: nginx SPA siempre sirve index.html con el meta de build actual. */
async function fetchBuildIdFromIndexHtml(): Promise<string | null> {
  const html = await fetchText(`/?build-check=${Date.now()}`);
  if (!html) return null;
  return parseBuildIdFromHtml(html);
}

export async function fetchDeployedBuildId(): Promise<string | null> {
  const [fromJson, fromIndex] = await Promise.all([
    fetchBuildIdFromVersionJson(),
    fetchBuildIdFromIndexHtml(),
  ]);

  return fromJson ?? fromIndex;
}

/** @deprecated Usar fetchDeployedBuildId */
export async function fetchDeployedVersion(): Promise<AppVersionPayload | null> {
  const buildId = await fetchDeployedBuildId();
  if (!buildId) return null;
  return { buildId, builtAt: buildId };
}
