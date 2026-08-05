import type { ConversationMessageEmitRow } from "../realtime/conversation-realtime-emit.js";

const TTL_MS = 30_000;

type CachedInboundContactContext = {
  contactId: string;
  contactName: string;
  conversationId: string;
  conversationBase: ConversationMessageEmitRow;
  expiresAt: number;
};

const cache = new Map<string, CachedInboundContactContext>();

function cacheKey(inboxId: string, identityKey: string): string {
  return `${inboxId}:${identityKey}`;
}

export function getInboundContactContext(
  inboxId: string,
  identityKey: string
): CachedInboundContactContext | null {
  const hit = cache.get(cacheKey(inboxId, identityKey));
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(cacheKey(inboxId, identityKey));
    return null;
  }
  return hit;
}

export function setInboundContactContext(params: {
  inboxId: string;
  identityKey: string;
  contactId: string;
  contactName: string;
  conversationId: string;
  conversationBase: ConversationMessageEmitRow;
}): void {
  cache.set(cacheKey(params.inboxId, params.identityKey), {
    contactId: params.contactId,
    contactName: params.contactName,
    conversationId: params.conversationId,
    conversationBase: params.conversationBase,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidateInboundContactContext(inboxId: string, identityKey: string): void {
  cache.delete(cacheKey(inboxId, identityKey));
}
