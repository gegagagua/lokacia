-- Extensions live in schema "extensions" (database search_path = public, extensions).
-- On managed/docker Postgres they are pre-created by infra/postgres/init.sql as superuser.
CREATE SCHEMA IF NOT EXISTS extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
