export interface MessageLocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export function parseMessageLocation(value: unknown): MessageLocationPayload | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const name = typeof row.name === "string" ? row.name.trim() : "";
  const address = typeof row.address === "string" ? row.address.trim() : "";

  return {
    latitude,
    longitude,
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
  };
}

export function formatLocationContent(location: MessageLocationPayload): string {
  return location.name || location.address || "Ubicación";
}

export function googleMapsUrl(location: MessageLocationPayload): string {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}
