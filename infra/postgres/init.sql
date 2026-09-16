-- App role must not be superuser so RLS applies (docs/DECISIONS.md).
CREATE ROLE lokacia LOGIN PASSWORD 'lokacia';
ALTER DATABASE lokacia OWNER TO lokacia;
\c lokacia
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION lokacia;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
ALTER DATABASE lokacia SET search_path = public, extensions;
ALTER SCHEMA public OWNER TO lokacia;
CREATE DATABASE lokacia_test OWNER lokacia;
\c lokacia_test
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION lokacia;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
ALTER DATABASE lokacia_test SET search_path = public, extensions;
ALTER SCHEMA public OWNER TO lokacia;
