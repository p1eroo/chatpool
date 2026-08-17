/**
 * Barrido puntual de contactos con nombre placeholder (Asociado / número).
 *
 *   npx tsx scripts/backfill-asociado-names.ts --dry-run
 *   npx tsx scripts/backfill-asociado-names.ts
 *   npx tsx scripts/backfill-asociado-names.ts --inbox-id=cmsf044z400067do6kds0kdph
 */
import { env } from "../src/config/env.js";
import { prisma } from "../src/infrastructure/database/prisma.client.js";
import {
  backfillAsociadoPlaceholderNames,
  buildAsociadosDirectory,
} from "../src/application/contacts/asociados-directory.service.js";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readArg(name: string): string | undefined {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1).trim() || undefined : undefined;
}

async function loadDirectory() {
  const url = env.ASOCIADOS_DIRECTORY_URL.trim();
  if (!url) {
    throw new Error("ASOCIADOS_DIRECTORY_URL está vacío");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`No se pudo cargar asociados: HTTP ${response.status}`);
  }

  return buildAsociadosDirectory(await response.json());
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const inboxId = readArg("--inbox-id");

  console.log(dryRun ? "Modo simulación (no escribe)." : "Aplicando nombres de asociados…");
  if (inboxId) console.log(`Bandeja: ${inboxId}`);

  const directory = await loadDirectory();
  console.log(`Directorio: ${directory.size} teléfonos`);

  const result = await backfillAsociadoPlaceholderNames({
    directory,
    dryRun,
    inboxId,
  });

  console.log(
    [
      `Contactos revisados: ${result.scanned}`,
      `Placeholders: ${result.placeholders}`,
      `${dryRun ? "Se actualizarían" : "Actualizados"}: ${result.updated}`,
      `Sin match en API: ${result.noMatch}`,
    ].join("\n")
  );

  for (const sample of result.samples) {
    console.log(`  ${sample.phone}: "${sample.from}" → "${sample.to}"`);
  }

  if (!dryRun) {
    console.log("Listo. Recarga el inbox para ver los nombres.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
