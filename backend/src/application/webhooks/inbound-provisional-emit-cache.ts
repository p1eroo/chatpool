const emitted = new Set<string>();

/** Evita emitir dos provisionales para el mismo wamid (retry Meta o fast path + persist). */
export function markInboundProvisionalEmitted(externalId: string): boolean {
  if (emitted.has(externalId)) return false;
  emitted.add(externalId);
  return true;
}

export function wasInboundProvisionalEmitted(externalId: string): boolean {
  return emitted.has(externalId);
}
