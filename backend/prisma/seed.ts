import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminPermissions = {
  manageInboxes: true,
  manageAgents: true,
  manageIntegrations: true,
  viewReports: true,
  assignConversations: true,
  resolveConversations: true,
  deleteConversations: true,
  sendMessages: true,
  manageLabels: true,
  manageCannedResponses: true,
};

const agentPermissions = {
  manageInboxes: false,
  manageAgents: false,
  manageIntegrations: false,
  viewReports: false,
  assignConversations: true,
  resolveConversations: true,
  deleteConversations: false,
  sendMessages: true,
  manageLabels: true,
  manageCannedResponses: true,
};

async function main() {
  await prisma.role.upsert({
    where: { id: "role-admin" },
    update: { permissions: adminPermissions },
    create: {
      id: "role-admin",
      name: "Administrador",
      isSystem: true,
      permissions: adminPermissions,
    },
  });

  await prisma.role.upsert({
    where: { id: "role-agent" },
    update: { permissions: agentPermissions },
    create: {
      id: "role-agent",
      name: "Agente",
      isSystem: true,
      permissions: agentPermissions,
    },
  });

  const soportePasswordHash = await bcrypt.hash("37>MNa&-39", 12);
  const demoPasswordHash = await bcrypt.hash("Chatpool123", 12);

  const soporte = await prisma.agent.upsert({
    where: { username: "soporte" },
    update: {
      name: "Soporte",
      passwordHash: soportePasswordHash,
      roleId: "role-admin",
      active: true,
    },
    create: {
      name: "Soporte",
      username: "soporte",
      passwordHash: soportePasswordHash,
      avatar: "SP",
      status: "online",
      roleId: "role-admin",
    },
  });

  const ana = await prisma.agent.upsert({
    where: { username: "ana.torres" },
    update: {},
    create: {
      name: "Ana Torres",
      username: "ana.torres",
      passwordHash: demoPasswordHash,
      phone: "+51 923 456 789",
      avatar: "AT",
      status: "away",
      roleId: "role-agent",
    },
  });

  const webhookBase = process.env.WEBHOOK_BASE_URL ?? "http://localhost:3001/webhooks";

  await prisma.integrationAccount.upsert({
    where: { provider: "meta" },
    update: { webhookUrl: `${webhookBase}/meta` },
    create: {
      id: "integration-meta",
      name: "Meta API",
      provider: "meta",
      description: "WhatsApp, Facebook e Instagram",
      connected: false,
      webhookUrl: `${webhookBase}/meta`,
    },
  });

  await prisma.integrationAccount.upsert({
    where: { provider: "email" },
    update: {},
    create: {
      id: "integration-email",
      name: "Correo SMTP",
      provider: "email",
      description: "Bandejas de correo electrónico",
      connected: true,
    },
  });

  await prisma.integrationAccount.upsert({
    where: { provider: "website" },
    update: {},
    create: {
      id: "integration-website",
      name: "Chat Web",
      provider: "website",
      description: "Widget en sitio propio",
      connected: true,
    },
  });

  const inbox = await prisma.inbox.upsert({
    where: { id: "seed-inbox-whatsapp" },
    update: {},
    create: {
      id: "seed-inbox-whatsapp",
      name: "WhatsApp Support",
      channelType: "whatsapp",
      icon: "whatsapp",
      settings: {
        create: {
          detail: "+51 987 654 321",
          status: "pending",
          provider: "meta",
          providerResource: "PoolTech Support",
          webhookUrl: `${webhookBase}/meta/seed-inbox-whatsapp`,
          webhookVerifyToken: "chatpool_meta_verify",
          whatsappProvider: "meta-cloud",
          description: "Bandeja demo para conectar Meta API",
        },
      },
      inboxAgents: {
        create: { agentId: soporte.id },
      },
    },
  });

  await prisma.label.upsert({
    where: { inboxId_name: { inboxId: inbox.id, name: "soporte" } },
    update: {},
    create: {
      inboxId: inbox.id,
      name: "soporte",
      color: "purple",
    },
  });

  await prisma.cannedResponse.createMany({
    data: [
      {
        title: "Saludo",
        content: "¡Hola! Gracias por escribirnos. ¿En qué puedo ayudarte hoy?",
      },
      {
        title: "Espera",
        content: "Un momento por favor, estoy revisando tu solicitud.",
      },
    ],
    skipDuplicates: true,
  });

  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

  const contactRecent = await prisma.contact.upsert({
    where: { id: "seed-contact-recent" },
    update: {},
    create: {
      id: "seed-contact-recent",
      inboxId: inbox.id,
      name: "María López",
      email: "maria@email.com",
      phone: "+51 987 111 222",
      avatar: "ML",
      waId: "51987111222",
    },
  });

  const contactExpired = await prisma.contact.upsert({
    where: { id: "seed-contact-expired" },
    update: {},
    create: {
      id: "seed-contact-expired",
      inboxId: inbox.id,
      name: "Carlos Mendoza",
      email: "carlos@email.com",
      phone: "+51 912 333 444",
      avatar: "CM",
      waId: "51912333444",
    },
  });

  const convOpen = await prisma.conversation.upsert({
    where: { id: "seed-conv-open" },
    update: {
      assigneeId: soporte.id,
      unreadCount: 1,
      updatedAt: hoursAgo(1),
    },
    create: {
      id: "seed-conv-open",
      inboxId: inbox.id,
      contactId: contactRecent.id,
      assigneeId: soporte.id,
      status: "open",
      priority: "medium",
      unreadCount: 1,
      updatedAt: hoursAgo(1),
    },
  });

  const convClosed = await prisma.conversation.upsert({
    where: { id: "seed-conv-closed" },
    update: {
      assigneeId: soporte.id,
      unreadCount: 0,
      updatedAt: hoursAgo(48),
    },
    create: {
      id: "seed-conv-closed",
      inboxId: inbox.id,
      contactId: contactExpired.id,
      assigneeId: soporte.id,
      status: "open",
      priority: "high",
      unreadCount: 0,
      updatedAt: hoursAgo(48),
    },
  });

  await prisma.message.deleteMany({
    where: {
      conversationId: { in: [convOpen.id, convClosed.id] },
    },
  });

  await prisma.message.createMany({
    data: [
      {
        id: "seed-msg-open-1",
        conversationId: convOpen.id,
        content: "Hola, ¿tienen stock del producto PT-200?",
        senderType: "contact",
        senderContactId: contactRecent.id,
        senderName: contactRecent.name,
        contentType: "text",
        status: "read",
        createdAt: hoursAgo(3),
      },
      {
        id: "seed-msg-open-2",
        conversationId: convOpen.id,
        content: "¡Hola María! Sí tenemos stock. ¿Cuántas unidades necesitas?",
        senderType: "agent",
        senderAgentId: soporte.id,
        senderName: soporte.name,
        contentType: "text",
        status: "delivered",
        createdAt: hoursAgo(2),
      },
      {
        id: "seed-msg-open-3",
        conversationId: convOpen.id,
        content: "Necesito 5 unidades para esta semana.",
        senderType: "contact",
        senderContactId: contactRecent.id,
        senderName: contactRecent.name,
        contentType: "text",
        status: "read",
        createdAt: hoursAgo(1),
      },
      {
        id: "seed-msg-closed-1",
        conversationId: convClosed.id,
        content: "Buenos días, ¿cuándo llega mi pedido #8821?",
        senderType: "contact",
        senderContactId: contactExpired.id,
        senderName: contactExpired.name,
        contentType: "text",
        status: "read",
        createdAt: hoursAgo(50),
      },
      {
        id: "seed-msg-closed-2",
        conversationId: convClosed.id,
        content: "Hola Carlos, tu pedido está en tránsito. Te avisamos cuando salga de almacén.",
        senderType: "agent",
        senderAgentId: soporte.id,
        senderName: soporte.name,
        contentType: "text",
        status: "delivered",
        createdAt: hoursAgo(49),
      },
    ],
  });

  await prisma.inboxAgent.upsert({
    where: {
      inboxId_agentId: { inboxId: inbox.id, agentId: ana.id },
    },
    update: {},
    create: {
      inboxId: inbox.id,
      agentId: ana.id,
    },
  });

  console.log("Seed completado.");
  console.log("Superadmin: soporte");
  console.log("Conversaciones demo: seed-conv-open (ventana abierta), seed-conv-closed (ventana 24h cerrada)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
