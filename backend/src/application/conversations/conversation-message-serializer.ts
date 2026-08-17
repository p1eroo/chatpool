import { logLockWait } from "../../shared/send-timing.js";

const tails = new Map<string, Promise<unknown>>();

/** Serializes message-related work per conversation (send order + sort keys). */
export function runWithConversationMessageLock<T>(
  conversationId: string,
  task: () => Promise<T>
): Promise<T> {
  const queuedAt = performance.now();
  const previous = tails.get(conversationId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => {
    logLockWait(conversationId, performance.now() - queuedAt);
    return task();
  });
  tails.set(
    conversationId,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}
