import { prisma } from "../../infrastructure/database/prisma.client.js";
import { mapContact } from "../mappers.js";

export async function listContacts(filters: { inboxId?: string }) {
  const where: Record<string, unknown> = {};

  if (filters.inboxId) {
    where.inboxId = filters.inboxId;
  }

  const rows = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return rows.map(mapContact);
}
