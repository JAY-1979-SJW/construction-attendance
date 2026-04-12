#!/usr/bin/env bash
# ============================================================
# common_data 계정 생성 (002-users.sh)
# docker-entrypoint-initdb.d 에서 자동 실행됨.
# 환경변수: COMMON_WRITER_PASSWORD, COMMON_READER_PASSWORD
# ============================================================
set -e

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB" <<-SQL

-- ── common_writer : INSERT/UPDATE/DELETE 허용, DDL 금지 ──────
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'common_writer') THEN
        CREATE ROLE common_writer
            LOGIN
            PASSWORD '${COMMON_WRITER_PASSWORD}';
    END IF;
END
\$\$;

GRANT CONNECT ON DATABASE common_data TO common_writer;
GRANT USAGE   ON SCHEMA public TO common_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES    IN SCHEMA public TO common_writer;
GRANT USAGE
    ON ALL SEQUENCES IN SCHEMA public TO common_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO common_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE                          ON SEQUENCES TO common_writer;

-- ── common_reader : SELECT 전용 ──────────────────────────────
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'common_reader') THEN
        CREATE ROLE common_reader
            LOGIN
            PASSWORD '${COMMON_READER_PASSWORD}';
    END IF;
END
\$\$;

GRANT CONNECT ON DATABASE common_data TO common_reader;
GRANT USAGE   ON SCHEMA public TO common_reader;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO common_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO common_reader;

SQL

echo "[002-users] common_writer / common_reader 계정 생성 완료"
