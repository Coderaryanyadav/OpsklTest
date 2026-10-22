#!/usr/bin/env bash
# Wait for HTTP readiness without claiming success from a fixed sleep alone.
set -euo pipefail

URL="${1:?usage: wait-for-health.sh URL [timeout-seconds]}"
TIMEOUT="${2:-120}"
START="$(date +%s)"

while true; do
  if curl -fsS -o /dev/null "$URL" 2>/dev/null; then
    printf '[wait-for-health] ready: %s\n' "$URL"
    exit 0
  fi
  NOW="$(date +%s)"
  if [ $((NOW - START)) -ge "$TIMEOUT" ]; then
    printf '[wait-for-health] timeout after %ss: %s\n' "$TIMEOUT" "$URL" >&2
    exit 1
  fi
  sleep 2
done
