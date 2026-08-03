const counters = new Map<string, number>();

export function nextOptimisticSortOrder(conversationId: string): number {
  const next = (counters.get(conversationId) ?? 0) + 1;
  counters.set(conversationId, next);
  return next;
}

export function syncOptimisticSortOrder(conversationId: string, sortOrder: number | undefined): void {
  if (sortOrder == null) return;
  const current = counters.get(conversationId) ?? 0;
  if (sortOrder > current) {
    counters.set(conversationId, sortOrder);
  }
}

export function seedOptimisticSortOrder(conversationId: string, messages: { sortOrder?: number }[]): void {
  const maxSortOrder = messages.reduce(
    (max, message) => Math.max(max, message.sortOrder ?? 0),
    0
  );
  if (maxSortOrder > 0) {
    syncOptimisticSortOrder(conversationId, maxSortOrder);
  }
}
