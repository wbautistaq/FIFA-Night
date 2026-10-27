#!/usr/bin/env bash
# Aplica stubs + migraciones + seed en una base temporal y ejecuta las pruebas SQL.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh
set -euo pipefail
DB=fifa_night_test
cd "$(dirname "$0")/.."
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f tests/00_stubs.sql
for f in migrations/*.sql; do echo "→ $f"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d $DB -f seed.sql
for f in tests/[1-9]*.sql; do echo "→ $f"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
echo "OK: migraciones y pruebas SQL"
