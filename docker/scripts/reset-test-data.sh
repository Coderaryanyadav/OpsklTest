#!/usr/bin/env bash
# Safe reset for the disposable stack only.
# This destroys the local Supabase database and the opskl-test compose volumes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/docker/compose/docker-compose.test.yml"
ENV_FILE="$ROOT/.env.docker.test"
PROJECT="opskl-test"

log() { printf '[reset] %s\n' "$*"; }
fail() { printf '[reset] ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "missing $ENV_FILE"
[ -f "$COMPOSE_FILE" ] || fail "missing $COMPOSE_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  http://127.0.0.1:54321|http://localhost:54321) ;;
  *) fail "refusing reset: NEXT_PUBLIC_SUPABASE_URL is not the local test endpoint" ;;
esac

log "stopping and removing only compose project '$PROJECT' and its volumes"
docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans || true

log "resetting the local Supabase database (migrations reapplied; test data cleared)"
npx --yes supabase db reset

log "recreating the isolated network aliases"
"$ROOT/docker/scripts/preflight.sh"

log "reset complete; run docker/scripts/run-e2e-tests.sh to reseed and test"
