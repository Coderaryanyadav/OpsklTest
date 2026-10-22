#!/usr/bin/env bash
# Prepare the isolated Docker test network and validate the disposable backend.
# This script never starts or points at a production environment.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.docker.test"
NETWORK="opskl-test-net"
DB_CONTAINER="supabase_db_OPSKIL"
API_CONTAINER="supabase_kong_OPSKIL"

log() { printf '[preflight] %s\n' "$*"; }
fail() { printf '[preflight] ERROR: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker info >/dev/null 2>&1 || fail "Docker daemon is not running"
docker compose version >/dev/null 2>&1 || fail "docker compose is not available"

[ -f "$ENV_FILE" ] || fail "missing $ENV_FILE; copy .env.docker.test.example and fill it with local Supabase values"

# Read only, then check the endpoint. Never print the file or its secrets.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  http://127.0.0.1:54321|http://localhost:54321) ;;
  *) fail "NEXT_PUBLIC_SUPABASE_URL must be the local Supabase API on port 54321" ;;
esac
[ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ] || fail "NEXT_PUBLIC_SUPABASE_ANON_KEY is empty"
[ -n "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ] || fail "EXPO_PUBLIC_SUPABASE_ANON_KEY is empty"
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail "SUPABASE_SERVICE_ROLE_KEY is empty (test runner only)"

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  log "local Supabase is not running; starting it with the Supabase CLI"
  npx --yes supabase start
fi

PROJECT_LABEL="$(docker inspect -f '{{ index .Config.Labels "com.supabase.cli.project" }}' "$DB_CONTAINER" 2>/dev/null || true)"
WORKDIR_LABEL="$(docker inspect -f '{{ index .Config.Labels "com.supabase.cli.workdir" }}' "$DB_CONTAINER" 2>/dev/null || true)"
[ "$PROJECT_LABEL" = "OPSKIL" ] || fail "refusing DB container with unexpected Supabase project label: ${PROJECT_LABEL:-<empty>}"
[ "$WORKDIR_LABEL" = "$ROOT" ] || fail "refusing DB container from a different workdir: ${WORKDIR_LABEL:-<empty>}"

log "waiting for disposable Supabase health"
for i in $(seq 1 60); do
  db_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$DB_CONTAINER" 2>/dev/null || echo missing)"
  kong_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' "$API_CONTAINER" 2>/dev/null || echo missing)"
  if [ "$db_status" = "healthy" ] && [ "$kong_status" = "healthy" ] &&
     curl -fsS "http://127.0.0.1:54321/auth/v1/health" >/dev/null 2>&1 &&
     curl -fsS "http://127.0.0.1:54321/rest/v1/" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    fail "Supabase did not become healthy (db=$db_status kong=$kong_status)"
  fi
  sleep 1
done

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  log "creating isolated network $NETWORK"
  docker network create "$NETWORK" >/dev/null
fi

# Re-attach with deterministic aliases. This is safe to repeat and does not
# affect any network other than the test network.
attach_alias() {
  local container="$1" alias="$2"
  docker network disconnect "$NETWORK" "$container" >/dev/null 2>&1 || true
  docker network connect --alias "$alias" "$NETWORK" "$container" >/dev/null
  log "attached $container to $NETWORK as $alias"
}
attach_alias "$DB_CONTAINER" "opskl-test-db"
attach_alias "$API_CONTAINER" "opskl-test-api"

log "disposable backend ready: auth/rest on opskl-test-api:8000, db on opskl-test-db:5432"
log "no production credential source is referenced by this script"
