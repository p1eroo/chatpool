import { env } from "./config/env.js";
import { resumePendingWhatsAppDeliveries } from "./application/conversations/message-delivery.service.js";
import { buildApp } from "./presentation/http/server.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    resumePendingWhatsAppDeliveries();
    console.log(`Chatpool API en http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
