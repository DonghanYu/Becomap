#!/usr/bin/env bash
# 로컬 Postgres에 데이터베이스를 새로 만들고 Supabase 스텁 → 마이그레이션 → 시드를 적용합니다.
# 사용: DATABASE_URL=postgres://postgres:postgres@localhost:5432/becomap bash scripts/db/local_reset.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/becomap}"
DB_NAME="${DB_URL##*/}"
ADMIN_URL="${DB_URL%/*}/postgres"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists \"$DB_NAME\" with (force);" -c "create database \"$DB_NAME\";"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
fi
echo "로컬 DB 준비 완료: $DB_NAME"
