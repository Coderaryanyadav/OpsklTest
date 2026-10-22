#!/usr/bin/env bash
# One-command build + seed + API/RLS + real-browser workflow run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/docker/compose/docker-compose.test.yml"
ENV_FILE="$ROOT/.env.docker.test"
REPORT_DIR="$ROOT/test-artifacts/docker"

mkdir -p "$REPORT_DIR"

"$ROOT/docker/scripts/preflight.sh"

echo '[e2e] building and starting app containers'
docker compose -p opskl-test --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build admin worker organizer

"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3001/api/health" 180
"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3002/healthz" 60
"$ROOT/docker/scripts/wait-for-health.sh" "http://127.0.0.1:3003/healthz" 60

echo '[e2e] running seed + API/RLS + browser tests in opskl-test-runner'
set +e
docker compose -p opskl-test --env-file "$ENV_FILE" -f "$COMPOSE_FILE" \
  run --rm --no-deps test-runner 2>&1 | tee "$REPORT_DIR/test-runner-console.log"
STATUS=${PIPESTATUS[0]}
set -e

echo "[e2e] test-runner exit code: $STATUS"
echo "[e2e] evidence: $REPORT_DIR/test-summary.json and $REPORT_DIR/*.png"
exit "$STATUS"
