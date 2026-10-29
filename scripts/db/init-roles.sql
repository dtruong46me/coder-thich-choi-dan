-- Runs once when the local Postgres container is created (docker-entrypoint-initdb.d).
-- ctcd (from POSTGRES_USER) owns the schema and runs migrations.
-- ctcd_app is what the app connects as: read/write rows, no DDL, and Row-Level Security applies to it.
CREATE ROLE ctcd_app LOGIN PASSWORD 'ctcd_app';
GRANT CONNECT ON DATABASE ctcd TO ctcd_app;
GRANT USAGE ON SCHEMA public TO ctcd_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ctcd IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ctcd_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ctcd IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ctcd_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ctcd IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ctcd_app;
