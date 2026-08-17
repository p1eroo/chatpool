import { env } from "./config/env.js";
import { startAsociadosDirectory } from "./application/contacts/asociados-directory.service.js";
import { resumePendingWhatsAppDeliveries } from "./application/conversations/message-delivery.service.js";
import { probeDatabaseLatency } from "./infrastructure/database/db-latency-probe.js";
import { buildApp } from "./presentation/http/server.js";

async function main() {
  const app = await buildApp();

  try {
    await probeDatabaseLatency();
    await app.listen({ port: env.PORT, host: env.HOST });
    resumePendingWhatsAppDeliveries();
    startAsociadosDirectory();
    console.log(`Chatpool API en http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
