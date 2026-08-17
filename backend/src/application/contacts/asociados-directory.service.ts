import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import {
  contactAvatarInitials,
  isPlaceholderContactName,
  sanitizeWhatsAppDisplayName,
  whatsAppPhoneLast9,
} from "../../shared/whatsapp-contact.js";
import { invalidateInboundContactContext } from "./inbound-contact-context-cache.js";
import { emitConversationUpdated } from "../realtime/realtime.service.js";

type PendingEnrichment = {
  inboxId: string;
  contactId: string;
  phone: string;
  conversationId: string;
};

const FETCH_TIMEOUT_MS = 20_000;
const RETRY_AFTER_FAIL_MS = 15_000;

let byLast9 = new Map<string, string>();
let inflight: Promise<void> | null = null;
let lastAttemptAt = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const pendingByContactId = new Map<string, PendingEnrichment>();

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formatAsociadoDisplayName(row: {
  codigo?: unknown;
  apellidos?: unknown;
  nombres?: unknown;
}): string | null {
  const codigo = asString(row.codigo);
  const rest = [asString(row.apellidos), asString(row.nombres)].filter(Boolean).join(" ");
  const raw = [codigo, rest].filter(Boolean).join(" ").trim();
  if (!raw) return null;
  return sanitizeWhatsAppDisplayName(raw, codigo || rest);
}

function indexPhone(map: Map<string, string>, raw: string, displayName: string) {
  const last9 = whatsAppPhoneLast9(raw);
  if (!last9) return;
  if (!map.has(last9)) map.set(last9, displayName);
}

export function buildAsociadosDirectory(payload: unknown): Map<string, string> {
  const next = new Map<string, string>();
  if (!payload || typeof payload !== "object") return next;

  const rows = (payload as { ARegistrados?: unknown }).ARegistrados;
  if (!Array.isArray(rows)) return next;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const displayName = formatAsociadoDisplayName(row);
    if (!displayName) continue;
    indexPhone(next, asString((row as { telefonop?: unknown }).telefonop), displayName);
    indexPhone(next, asString((row as { telefonos?: unknown }).telefonos), displayName);
  }

  return next;
}

export function isAsociadosDirectoryReady(): boolean {
  return byLast9.size > 0;
}

export function lookupAsociadoDisplayName(phone: string): string | null {
  ensureAsociadosDirectoryFetch();
  const last9 = whatsAppPhoneLast9(phone);
  if (!last9) return null;
  return byLast9.get(last9) ?? null;
}

export function enqueueAsociadoNameEnrichment(params: PendingEnrichment) {
  pendingByContactId.set(params.contactId, params);
}

function ensureAsociadosDirectoryFetch() {
  if (env.NODE_ENV === "test") return;
  if (!env.ASOCIADOS_DIRECTORY_URL.trim()) return;
  if (byLast9.size > 0) return;
  if (inflight) return;
  if (lastAttemptAt > 0 && Date.now() - lastAttemptAt < RETRY_AFTER_FAIL_MS) return;
  void refreshAsociadosDirectory();
}

async function refreshAsociadosDirectory() {
  const url = env.ASOCIADOS_DIRECTORY_URL.trim();
  if (!url || env.NODE_ENV === "test") return;
  if (inflight) return inflight;

  lastAttemptAt = Date.now();
  inflight = (async () => {
    const started = Date.now();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const next = buildAsociadosDirectory(payload);
      if (next.size === 0) {
        throw new Error("directorio vacío");
      }

      byLast9 = next;
      console.log(
        `[asociados] ${next.size} teléfonos indexados en ${Date.now() - started}ms`
      );
      await drainPendingEnrichments();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[asociados] no se pudo cargar el directorio: ${reason}`);
      if (byLast9.size === 0) {
        setTimeout(() => {
          void refreshAsociadosDirectory();
        }, RETRY_AFTER_FAIL_MS).unref();
      }
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

async function drainPendingEnrichments() {
  if (pendingByContactId.size === 0) return;

  const pending = [...pendingByContactId.values()];
  pendingByContactId.clear();

  for (const item of pending) {
    try {
      await applyAsociadoNameIfPlaceholder(item);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(
        `[asociados] no se pudo enriquecer contact=${item.contactId}: ${reason}`
      );
    }
  }
}

async function applyAsociadoNameIfPlaceholder(params: PendingEnrichment) {
  const displayName = lookupAsociadoDisplayName(params.phone);
  if (!displayName) return;

  const contact = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: { id: true, name: true, waId: true, phone: true },
  });
  if (!contact) return;

  const identity = contact.waId || contact.phone || params.phone;
  if (!isPlaceholderContactName(contact.name, identity)) return;
  if (contact.name === displayName) return;

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      name: displayName,
      avatar: contactAvatarInitials(displayName, params.phone),
    },
  });

  invalidateInboundContactContext(params.inboxId, identity);
  await emitConversationUpdated(params.conversationId);
}

export function startAsociadosDirectory() {
  if (env.NODE_ENV === "test") return;
  if (!env.ASOCIADOS_DIRECTORY_URL.trim()) return;

  void refreshAsociadosDirectory();

  if (refreshTimer || env.ASOCIADOS_DIRECTORY_TTL_MS <= 0) return;
  refreshTimer = setInterval(() => {
    void refreshAsociadosDirectory();
  }, env.ASOCIADOS_DIRECTORY_TTL_MS);
  refreshTimer.unref();
}

export type AsociadoBackfillSample = {
  contactId: string;
  phone: string;
  from: string;
  to: string;
};

export type AsociadoBackfillResult = {
  directorySize: number;
  scanned: number;
  placeholders: number;
  updated: number;
  noMatch: number;
  samples: AsociadoBackfillSample[];
};

/** Barrido puntual: solo placeholders (Asociado / número). No pisa nombres reales. */
export async function backfillAsociadoPlaceholderNames(params: {
  directory: Map<string, string>;
  dryRun?: boolean;
  inboxId?: string;
  sampleLimit?: number;
}): Promise<AsociadoBackfillResult> {
  const sampleLimit = params.sampleLimit ?? 20;
  const contacts = await prisma.contact.findMany({
    where: params.inboxId ? { inboxId: params.inboxId } : undefined,
    select: { id: true, inboxId: true, name: true, phone: true, waId: true },
  });

  const result: AsociadoBackfillResult = {
    directorySize: params.directory.size,
    scanned: contacts.length,
    placeholders: 0,
    updated: 0,
    noMatch: 0,
    samples: [],
  };

  for (const contact of contacts) {
    const identity = contact.waId || contact.phone || "";
    if (!isPlaceholderContactName(contact.name, identity)) continue;
    result.placeholders += 1;

    const last9 = whatsAppPhoneLast9(contact.phone || contact.waId || "");
    const displayName = last9 ? params.directory.get(last9) ?? null : null;
    if (!displayName || displayName === contact.name) {
      result.noMatch += 1;
      continue;
    }

    if (result.samples.length < sampleLimit) {
      result.samples.push({
        contactId: contact.id,
        phone: contact.phone || contact.waId || "",
        from: contact.name,
        to: displayName,
      });
    }

    if (params.dryRun) {
      result.updated += 1;
      continue;
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: displayName,
        avatar: contactAvatarInitials(displayName, last9),
      },
    });
    invalidateInboundContactContext(contact.inboxId, identity);
    result.updated += 1;
  }

  return result;
}
