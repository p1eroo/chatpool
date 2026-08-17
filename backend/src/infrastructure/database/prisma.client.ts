import { Prisma, PrismaClient } from "@prisma/client";
import { isSendTimingEnabled } from "../../shared/send-timing.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaQueryLogAttached?: boolean;
};

function prismaLog(): Prisma.LogDefinition[] {
  if (isSendTimingEnabled()) {
    return [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ];
  }

  return process.env.NODE_ENV === "development"
    ? [
        { emit: "stdout", level: "warn" },
        { emit: "stdout", level: "error" },
      ]
    : [{ emit: "stdout", level: "error" }];
}

function attachQueryLog(client: PrismaClient): void {
  if (!isSendTimingEnabled() || globalForPrisma.prismaQueryLogAttached) return;

  client.$on("query", (event) => {
    const sql = event.query.replace(/\s+/g, " ").trim();
    const preview = sql.length > 180 ? `${sql.slice(0, 180)}…` : sql;
    console.info(`[prisma] ${event.duration}ms ${preview}`);
  });

  globalForPrisma.prismaQueryLogAttached = true;
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: prismaLog() });

attachQueryLog(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
