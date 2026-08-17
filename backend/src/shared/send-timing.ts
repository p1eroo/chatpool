import { env } from "../config/env.js";

type RequestTiming = {
  authMs?: number;
  permMs?: number;
};

const requestTiming = new WeakMap<object, RequestTiming>();

/** Activo en development. `SEND_TIMING=0` lo apaga; `SEND_TIMING=1` lo fuerza en production. */
export function isSendTimingEnabled(): boolean {
  if (process.env.SEND_TIMING === "0") return false;
  if (process.env.SEND_TIMING === "1") return true;
  return env.NODE_ENV !== "production";
}

export function noteRequestAuthMs(request: object, ms: number): void {
  if (!isSendTimingEnabled()) return;
  const current = requestTiming.get(request) ?? {};
  current.authMs = ms;
  requestTiming.set(request, current);
}

export function noteRequestPermMs(request: object, ms: number): void {
  if (!isSendTimingEnabled()) return;
  const current = requestTiming.get(request) ?? {};
  current.permMs = ms;
  requestTiming.set(request, current);
}

export function logSendHandlerStart(conversationId: string, request: object): void {
  if (!isSendTimingEnabled()) return;
  const timing = requestTiming.get(request);
  console.info(
    `[send] handler-start conversation=${conversationId} auth=${formatMs(timing?.authMs)} perm=${formatMs(timing?.permMs)}`
  );
}

export function createSendTimer(conversationId: string) {
  if (!isSendTimingEnabled()) {
    return {
      mark: (_step: string, _extra?: Record<string, unknown>) => undefined,
      summary: () => undefined,
    };
  }

  const start = performance.now();
  let last = start;
  const steps: string[] = [];

  return {
    mark(step: string, extra?: Record<string, unknown>) {
      const now = performance.now();
      const deltaMs = now - last;
      const totalMs = now - start;
      last = now;
      steps.push(`${step}:${deltaMs.toFixed(0)}`);
      const extraText = extra ? ` ${JSON.stringify(extra)}` : "";
      console.info(
        `[send] ${step} +${deltaMs.toFixed(1)}ms total=${totalMs.toFixed(1)}ms conversation=${conversationId}${extraText}`
      );
    },
    summary() {
      console.info(
        `[send] summary total=${(performance.now() - start).toFixed(1)}ms conversation=${conversationId} ${steps.join(" | ")}`
      );
    },
  };
}

export function logLockWait(conversationId: string, waitMs: number): void {
  if (!isSendTimingEnabled() || waitMs < 5) return;
  console.info(`[lock] wait=${waitMs.toFixed(1)}ms conversation=${conversationId}`);
}

export function logDeliveryTiming(
  phase: string,
  params: { conversationId: string; messageId: string; ms?: number }
): void {
  if (!isSendTimingEnabled()) return;
  const elapsed = params.ms !== undefined ? ` +${params.ms.toFixed(1)}ms` : "";
  console.info(
    `[delivery] ${phase}${elapsed} message=${params.messageId} conversation=${params.conversationId}`
  );
}

function formatMs(value: number | undefined): string {
  return value === undefined ? "?" : `${value.toFixed(1)}ms`;
}
