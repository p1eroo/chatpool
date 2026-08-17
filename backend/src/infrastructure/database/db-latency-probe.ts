import { env } from "../../config/env.js";
import { prisma } from "./prisma.client.js";

function databaseHostLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port || "5432";
    return `${parsed.hostname}:${port}`;
  } catch {
    return "(url inválida)";
  }
}

/** Mide RTT a Postgres sin lógica de negocio. No imprime credenciales. */
export async function probeDatabaseLatency(rounds = 10): Promise<void> {
  const host = databaseHostLabel(env.DATABASE_URL);
  console.info(`[db-probe] host=${host} rounds=${rounds}`);

  for (let i = 1; i <= rounds; i++) {
    const started = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    console.info(`[db-probe] SELECT 1 #${i}: ${(performance.now() - started).toFixed(1)}ms`);
  }
}
