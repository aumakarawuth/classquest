#!/usr/bin/env bash
# Verify migrations against a throwaway local Postgres (no Docker needed).
# Usage: supabase/tests/local/run.sh   (requires PostgreSQL 15+ server binaries on PATH or PG_BIN)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
bin="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")}"
data="$(mktemp -d)"
port="${PGPORT_TEST:-54329}"
trap '"$bin/pg_ctl" -D "$data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$data"' EXIT
"$bin/initdb" -D "$data" -U postgres --auth=trust >/dev/null
"$bin/pg_ctl" -D "$data" -o "-p $port -k $data" -l "$data/log" start -w >/dev/null
psql=(psql -h "$data" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${psql[@]}" -f "$here/supabase_stub.sql"
for f in "$root"/migrations/*.sql; do "${psql[@]}" -f "$f"; done
if [ "${1:-}" = "--seed" ]; then
  # Fresh DB with seed only (tests use their own fixtures and must not see seed rows).
  "${psql[@]}" -f "$root/seed.sql"
  "${psql[@]}" -t -A -f "$here/seed_check.sql"
  exit 0
fi
status=0
for t in "$root"/tests/database/*.test.sql; do
  echo "# $(basename "$t")"
  "${psql[@]}" -t -A -f "$t" || status=1
done
exit $status
