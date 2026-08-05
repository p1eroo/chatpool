import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma.client.js";
import { AppError, NotFoundError } from "../../domain/errors.js";
import {
  assertAgentCanAccessConversation,
  assertAgentCanAccessInbox,
} from "../inboxes/inbox-access.service.js";
import {
  copyConversationMediaFromKey,
  uploadConversationMedia,
} from "../media/media-storage.service.js";
import { resolveMessageAttachment } from "../media/message-attachment.service.js";
import { mapMessage } from "../mappers.js";
import { sendAgentMessage } from "./conversations.service.js";
import type { SendMessageBody } from "../../types/api-responses.js";

const FORWARDABLE_CONTENT_TYPES = new Set([
  "text",
  "image",
  "file",
  "audio",
  "sticker",
]);

const FORWARD_CONCURRENCY = 4;

type SourceMessage = {
  id: string;
  content: string;
  senderType: string;
  isPrivate: boolean;
  contentType: string;
  fileName: string | null;
  fileSize: number | null;
  fileKey: string | null;
  mimeType: string | null;
  sortOrder: number;
};

export type ForwardDeliveryInput = {
  sourceMessageId: string;
  targetConversationId: string;
  clientMessageId: string;
};

type ForwardJob = {
  sourceMessage: SourceMessage;
  targetConversationId: string;
  clientMessageId: string;
};

function isForwardableMessage(message: SourceMessage): boolean {
  if (message.senderType === "system") return false;
  if (message.isPrivate) return false;
  return FORWARDABLE_CONTENT_TYPES.has(message.contentType);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await mapper(items[current]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function prepareForwardMedia(params: {
  sourceConversationId: string;
  targetConversationId: string;
  message: SourceMessage;
}): Promise<Pick<SendMessageBody, "fileName" | "fileSize" | "fileKey" | "mimeType">> {
  const fileName = params.message.fileName ?? "archivo";
  const mimeType = params.message.mimeType ?? "application/octet-stream";
  const fileSize = params.message.fileSize ?? 0;

  if (params.message.fileKey) {
    const copied = await copyConversationMediaFromKey({
      conversationId: params.targetConversationId,
      sourceKey: params.message.fileKey,
      originalName: fileName,
      mimeType,
      fileSize,
    });
    return {
      fileName: copied.fileName,
      fileSize: copied.fileSize,
      fileKey: copied.fileKey,
      mimeType: copied.mimeType,
    };
  }

  const attachment = await resolveMessageAttachment(
    params.sourceConversationId,
    params.message.id
  );
  const stored = await uploadConversationMedia({
    conversationId: params.targetConversationId,
    buffer: attachment.buffer,
    originalName: attachment.fileName,
    mimeType: attachment.mimeType,
  });

  return {
    fileName: stored.fileName,
    fileSize: stored.fileSize,
    fileKey: stored.fileKey,
    mimeType: stored.mimeType,
  };
}

export type ForwardMessageResult = {
  sourceMessageId: string;
  conversationId: string;
  clientMessageId: string;
  success: boolean;
  message?: ReturnType<typeof mapMessage>;
  error?: string;
  code?: string;
};

async function executeForwardJobsPreservingOrder(params: {
  agentId: string;
  sourceConversationId: string;
  jobs: ForwardJob[];
}): Promise<ForwardMessageResult[]> {
  const jobsByTarget = new Map<string, ForwardJob[]>();

  for (const job of params.jobs) {
    const targetJobs = jobsByTarget.get(job.targetConversationId) ?? [];
    targetJobs.push(job);
    jobsByTarget.set(job.targetConversationId, targetJobs);
  }

  const resultByClientId = new Map<string, ForwardMessageResult>();

  await mapWithConcurrency([...jobsByTarget.entries()], FORWARD_CONCURRENCY, async ([, targetJobs]) => {
    for (const job of targetJobs) {
      const result = await executeForwardJob({
        agentId: params.agentId,
        sourceConversationId: params.sourceConversationId,
        job,
      });
      resultByClientId.set(job.clientMessageId, result);
    }
  });

  return params.jobs.map((job) => {
    const result = resultByClientId.get(job.clientMessageId);
    if (!result) {
      throw new Error("Resultado de reenvío incompleto");
    }
    return result;
  });
}

async function executeForwardJob(params: {
  agentId: string;
  sourceConversationId: string;
  job: ForwardJob;
}): Promise<ForwardMessageResult> {
  const { job, agentId, sourceConversationId } = params;
  const { sourceMessage, targetConversationId, clientMessageId } = job;

  try {
    let mediaFields: Pick<SendMessageBody, "fileName" | "fileSize" | "fileKey" | "mimeType"> = {};

    if (sourceMessage.contentType !== "text") {
      mediaFields = await prepareForwardMedia({
        sourceConversationId,
        targetConversationId,
        message: sourceMessage,
      });
    }

    const sent = await sendAgentMessage(targetConversationId, agentId, {
      content: sourceMessage.content,
      contentType: sourceMessage.contentType as SendMessageBody["contentType"],
      ...mediaFields,
      clientMessageId,
    });

    return {
      sourceMessageId: sourceMessage.id,
      conversationId: targetConversationId,
      clientMessageId,
      success: true,
      message: sent,
    };
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo reenviar el mensaje";
    const code = error instanceof AppError ? error.code : undefined;

    return {
      sourceMessageId: sourceMessage.id,
      conversationId: targetConversationId,
      clientMessageId,
      success: false,
      error: message,
      code,
    };
  }
}

function buildForwardJobs(params: {
  sourceMessages: SourceMessage[];
  targetConversationIds: string[];
  deliveries?: ForwardDeliveryInput[];
}): ForwardJob[] {
  const sourceById = new Map(params.sourceMessages.map((message) => [message.id, message]));

  if (params.deliveries && params.deliveries.length > 0) {
    return params.deliveries.map((delivery) => {
      const sourceMessage = sourceById.get(delivery.sourceMessageId);
      if (!sourceMessage) {
        throw new NotFoundError("Uno o más mensajes no existen");
      }
      return {
        sourceMessage,
        targetConversationId: delivery.targetConversationId,
        clientMessageId: delivery.clientMessageId.trim(),
      };
    });
  }

  const jobs: ForwardJob[] = [];
  for (const targetConversationId of params.targetConversationIds) {
    for (const sourceMessage of params.sourceMessages) {
      jobs.push({
        sourceMessage,
        targetConversationId,
        clientMessageId: `fwd-${randomUUID()}`,
      });
    }
  }
  return jobs;
}

export async function forwardMessages(params: {
  agentId: string;
  sourceConversationId: string;
  messageIds: string[];
  targetConversationIds: string[];
  deliveries?: ForwardDeliveryInput[];
}) {
  await assertAgentCanAccessConversation(params.agentId, params.sourceConversationId);

  const uniqueMessageIds = [...new Set(params.messageIds.map((id) => id.trim()).filter(Boolean))];
  const uniqueTargetIds = [
    ...new Set(params.targetConversationIds.map((id) => id.trim()).filter(Boolean)),
  ];

  if (uniqueMessageIds.length === 0) {
    throw new AppError("Selecciona al menos un mensaje", 422, "NO_MESSAGES");
  }
  if (uniqueTargetIds.length === 0) {
    throw new AppError("Selecciona al menos un destino", 422, "NO_TARGETS");
  }

  const sourceConversation = await prisma.conversation.findUnique({
    where: { id: params.sourceConversationId },
    select: { inboxId: true },
  });
  if (!sourceConversation) {
    throw new NotFoundError("Conversación no encontrada");
  }

  const sourceMessages = await prisma.message.findMany({
    where: {
      id: { in: uniqueMessageIds },
      conversationId: params.sourceConversationId,
    },
    select: {
      id: true,
      content: true,
      senderType: true,
      isPrivate: true,
      contentType: true,
      fileName: true,
      fileSize: true,
      fileKey: true,
      mimeType: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (sourceMessages.length !== uniqueMessageIds.length) {
    throw new NotFoundError("Uno o más mensajes no existen");
  }

  for (const message of sourceMessages) {
    if (!isForwardableMessage(message)) {
      throw new AppError("Uno o más mensajes no se pueden reenviar", 422, "MESSAGE_NOT_FORWARDABLE");
    }
  }

  const targetConversations = await prisma.conversation.findMany({
    where: { id: { in: uniqueTargetIds } },
    select: { id: true, inboxId: true },
  });

  if (targetConversations.length !== uniqueTargetIds.length) {
    throw new NotFoundError("Una o más conversaciones no existen");
  }

  for (const target of targetConversations) {
    await assertAgentCanAccessInbox(params.agentId, target.inboxId);
    if (target.inboxId !== sourceConversation.inboxId) {
      throw new AppError(
        "Solo puedes reenviar dentro de la misma bandeja de WhatsApp",
        422,
        "INBOX_MISMATCH"
      );
    }
  }

  if (params.deliveries?.length) {
    const targetSet = new Set(uniqueTargetIds);
    const messageSet = new Set(uniqueMessageIds);

    for (const delivery of params.deliveries) {
      if (!messageSet.has(delivery.sourceMessageId)) {
        throw new AppError("Entrega de reenvío inválida", 422, "INVALID_DELIVERY");
      }
      if (!targetSet.has(delivery.targetConversationId)) {
        throw new AppError("Destino de reenvío inválido", 422, "INVALID_DELIVERY");
      }
      if (!delivery.clientMessageId.trim()) {
        throw new AppError("clientMessageId requerido", 422, "INVALID_DELIVERY");
      }
    }
  }

  const jobs = buildForwardJobs({
    sourceMessages,
    targetConversationIds: uniqueTargetIds,
    deliveries: params.deliveries,
  });

  const results = await executeForwardJobsPreservingOrder({
    agentId: params.agentId,
    sourceConversationId: params.sourceConversationId,
    jobs,
  });

  const sent = results.filter((item) => item.success).length;
  const failed = results.length - sent;

  return {
    results,
    summary: { sent, failed, total: results.length },
  };
}
