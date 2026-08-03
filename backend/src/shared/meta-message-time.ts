/** Convierte el timestamp Unix (segundos) de Meta en Date para createdAt. */
export function parseMetaMessageTimestamp(timestamp?: string): Date {
  if (!timestamp) return new Date();

  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date();

  return new Date(seconds * 1000);
}
