import { prisma } from "../../infrastructure/database/prisma.client.js";
import { messageInclude } from "../mappers.js";
import { emitMessageCreated } from "../realtime/realtime.service.js";
import { runWithConversationMessageLock } from "./conversation-message-serializer.js";
import { nextMessageSortOrder } from "./message-sort-order.js";

async function resolveActorName(actorAgentId?: string | null): Promise<string> {
  if (!actorAgentId) return "Sistema";

  const agent = await prisma.agent.findUnique({
    where: { id: actorAgentId },
    select: { name: true },
  });

  return agent?.name ?? "Sistema";
}

export async function createConversationActivityMessage(params: {
  conversationId: string;
  content: string;
  actorAgentId?: string | null;
}): Promise<void> {
  await runWithConversationMessageLock(params.conversationId, async () => {
    const sortOrder = await nextMessageSortOrder(params.conversationId);

    const message = await prisma.message.create({
      data: {
        conversationId: params.conversationId,
        content: params.content,
        senderType: "system",
        senderAgentId: params.actorAgentId ?? null,
        contentType: "text",
        status: "sent",
        sortOrder,
      },
      include: messageInclude,
    });

    await emitMessageCreated(params.conversationId, message.id, { message });
  });
}

export async function recordConversationStatusActivity(params: {
  conversationId: string;
  previousStatus: string;
  nextStatus: string;
  actorAgentId?: string | null;
}): Promise<void> {
  if (params.previousStatus === params.nextStatus) return;

  const actorName = await resolveActorName(params.actorAgentId);
  let content: string | null = null;

  if (params.nextStatus === "resolved") {
    content = `La conversación fue marcada como resuelta por ${actorName}`;
  } else if (params.nextStatus === "open" && params.previousStatus === "resolved") {
    content = `La conversación fue reabierta por ${actorName}`;
  }

  if (!content) return;

  await createConversationActivityMessage({
    conversationId: params.conversationId,
    content,
    actorAgentId: params.actorAgentId,
  });
}

export async function recordConversationAssigneeActivity(params: {
  conversationId: string;
  previousAssigneeId: string | null;
  nextAssigneeId: string | null | undefined;
  actorAgentId?: string | null;
}): Promise<void> {
  if (params.nextAssigneeId === undefined) return;
  if (params.previousAssigneeId === params.nextAssigneeId) return;

  const actorName = await resolveActorName(params.actorAgentId);
  let content: string;

  if (params.nextAssigneeId === null) {
    content = `La conversación fue desasignada por ${actorName}`;
  } else {
    const assignee = await prisma.agent.findUnique({
      where: { id: params.nextAssigneeId },
      select: { name: true },
    });
    content = `La conversación fue asignada a ${assignee?.name ?? "un agente"} por ${actorName}`;
  }

  await createConversationActivityMessage({
    conversationId: params.conversationId,
    content,
    actorAgentId: params.actorAgentId,
  });
}

export async function recordConversationLabelActivity(params: {
  conversationId: string;
  labelName: string;
  added: boolean;
  actorAgentId?: string | null;
}): Promise<void> {
  const actorName = await resolveActorName(params.actorAgentId);
  const content = params.added
    ? `Se añadió la etiqueta "${params.labelName}" por ${actorName}`
    : `Se quitó la etiqueta "${params.labelName}" por ${actorName}`;

  await createConversationActivityMessage({
    conversationId: params.conversationId,
    content,
    actorAgentId: params.actorAgentId,
  });
}

export async function recordConversationAutoReopenedActivity(
  conversationId: string
): Promise<void> {
  await createConversationActivityMessage({
    conversationId,
    content: "La conversación fue reabierta por un nuevo mensaje entrante",
  });
}

export async function recordContactSharedPhoneActivity(
  conversationId: string,
  phone: string
): Promise<void> {
  await createConversationActivityMessage({
    conversationId,
    content: `El contacto compartió su número: ${phone}`,
  });
}
