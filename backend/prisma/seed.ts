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

  await prisma.agent.upsert({
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

  await prisma.agent.upsert({
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

  await prisma.integrationAccount.deleteMany({
    where: { provider: { notIn: ["meta"] } },
  });

  // Las respuestas predefinidas son por bandeja; se crean vacías al iniciar un buzón.

  console.log("Seed completado.");
  console.log("Superadmin: soporte");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
