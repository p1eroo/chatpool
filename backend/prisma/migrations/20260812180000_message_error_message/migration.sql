-- Motivo legible cuando un mensaje falla al entregarse (Meta / ventana 24h / etc.)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
