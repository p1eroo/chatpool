import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("365d"),
  CORS_ORIGIN: z.string().default("http://localhost:5174"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3001"),
  WEBHOOK_BASE_URL: z.string().default("http://localhost:3001/webhooks"),
  /**
   * @deprecated Ya no se usa: Application API usa `/api/v1/inboxes/:inboxId`.
   * Se mantiene por compatibilidad con .env existentes.
   */
  API_ACCOUNT_ID: z.string().default("1"),
  /** Agente que atribuye mensajes/acciones de la Application API. */
  API_AGENT_ID: z.string().optional(),
  /** Verify token del webhook global GET /webhooks/meta (Meta Developer Console). */
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(8).default("chatpool_meta_verify"),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_APP_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default("true"),
  FILES_MAX_MB: z.coerce.number().default(50),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
