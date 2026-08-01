-- Ejecutar en tu servidor PostgreSQL como superusuario (postgres)
-- psql -U postgres -f scripts/setup-db.sql

CREATE USER chatpool WITH PASSWORD 'CAMBIAR_PASSWORD';

CREATE DATABASE chatpool
  OWNER chatpool
  ENCODING 'UTF8'
  LC_COLLATE 'en_US.UTF-8'
  LC_CTYPE 'en_US.UTF-8'
  TEMPLATE template0;

GRANT ALL PRIVILEGES ON DATABASE chatpool TO chatpool;

\c chatpool

GRANT ALL ON SCHEMA public TO chatpool;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO chatpool;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO chatpool;
