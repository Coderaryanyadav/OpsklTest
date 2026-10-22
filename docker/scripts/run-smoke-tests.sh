#!/usr/bin/env bash
# Build and start the three app experiences, then run readiness checks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/docker/compose/docker-compose.test.yml"
ENV_FILE="$ROOT/.env.docker.test"

"$ROOT/docker/scripts/preflight.sh"

echo '[smoke] building and starting admin, worker, and organizer'
docker compose -p opskl-test --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build admin worker organizer

"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3001/api/health" 180
"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3002/healthz" 60
"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3003/healthz" 60
"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:54321/auth/v1/health" 60

# The service-role key must never be injected into an app container. Only the
# test runner receives it for synthetic fixture setup and state verification.
for service in admin worker organizer; do
  cid="$(docker compose -p opskl-test --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  [ -n "$cid" ] || { echo "[smoke] ERROR: $service container is missing" >&2; exit 1; }
  if docker exec "$cid" sh -c 'env | grep -q SUPABASE_SERVICE_ROLE_KEY'; then
    echo "[smoke] ERROR: service-role key is present in the $service container" >&2
    exit 1
  fi
done
echo '[smoke] PASS: app containers do not receive the service-role key'

echo '[smoke] container status'
docker compose -p opskl-test --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo '[smoke] PASS: admin, worker, organizer, and disposable auth API are ready'
echo '[smoke] app URLs: admin http://127.0.0.1:3001  worker http://127.0.0.1:3002  organizer http://127.0.0.1:3003'
