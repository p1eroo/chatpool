import { metaTimestampSortBase } from "./message-sort-order.js";

type InboundTask = {
  sortKey: number;
  run: () => Promise<unknown>;
};

const queues = new Map<string, InboundTask[]>();
const drains = new Map<string, Promise<void>>();

let arrivalCounter = 0;

/** Clave de cola: segundo Meta + índice en batch + orden de llegada al servidor. */
export function computeInboundQueueSortKey(
  metaTimestamp: string | undefined,
  batchIndex: number
): number {
  const base = metaTimestampSortBase(metaTimestamp) ?? Math.floor(Date.now() / 1000);
  const cappedIndex = Math.min(Math.max(batchIndex, 0), 999);
  const seq = arrivalCounter++ % 1000;
  // Solo orden en memoria (JS number); no se persiste en sort_order.
  return base * 10_000 + cappedIndex * 10 + seq;
}

async function drainInboundQueue(key: string): Promise<void> {
  while (true) {
    const queue = queues.get(key);
    if (!queue?.length) {
      queues.delete(key);
      drains.delete(key);
      return;
    }

    queue.sort((a, b) => a.sortKey - b.sortKey);
    const next = queue.shift();
    if (!next) continue;

    await next.run().catch(() => undefined);
  }
}

/** Encola trabajo entrante por contacto; drena en orden de sortKey (FIFO por chat). */
export function scheduleInboundContactTask<T>(
  inboxId: string,
  contactIdentityKey: string,
  sortKey: number,
  task: () => Promise<T>
): Promise<T> {
  const key = `${inboxId}:${contactIdentityKey}`;

  return new Promise<T>((resolve, reject) => {
    const queue = queues.get(key) ?? [];
    queue.push({
      sortKey,
      run: async () => {
        try {
          const result = await task();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      },
    });
    queues.set(key, queue);

    const previous = drains.get(key) ?? Promise.resolve();
    const drain = previous
      .catch(() => undefined)
      .then(() => drainInboundQueue(key));
    drains.set(key, drain);
  });
}

/** @deprecated Use scheduleInboundContactTask */
export function runWithInboundContactLock<T>(
  inboxId: string,
  contactIdentityKey: string,
  task: () => Promise<T>
): Promise<T> {
  return scheduleInboundContactTask(
    inboxId,
    contactIdentityKey,
    computeInboundQueueSortKey(undefined, 0),
    task
  );
}
