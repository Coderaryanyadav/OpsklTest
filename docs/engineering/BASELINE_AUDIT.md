# BASELINE_AUDIT — Deep Repair Session

**Timestamp (UTC):** 2026-10-21T07:44:07Z  
**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Branch:** `feat/stitch-design-to-code-phases`  
**Preserved user work (do not discard):**
- Modified: admin Playwright, worker incident report, shared safety_incident_service + tests
- Untracked: `docs/verification/**`, `supabase/migrations/20261021000000_incident_evidence_storage.sql`

## Architecture discovered (from files)

| Path | Role |
| --- | --- |
| `apps/worker` | Expo Router worker app |
| `apps/organizer` | Expo Router organizer app |
| `apps/admin` | Next.js 15 admin portal |
| `packages/shared` | Supabase clients, RPCs, services, payments |
| `packages/design-system` | RN UI / tokens |
| `packages/validation` | Zod schemas |
| `supabase/migrations` | Postgres schema, RLS, RPCs |
| Auth/DB | Supabase (GoTrue + Postgres + Storage) |

**Package manager:** npm workspaces + `package-lock.json`  
**Runtimes:** Node `v26.11.1`, npm `11.20.0`

## Environment (names only)

Present in local `.env` (values not printed): `DATABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Fresh baseline commands

| Command | CWD | Exit | Summary | Mocks/Live | Evidence |
| --- | --- | --- | --- | --- | --- |
| `npm run typecheck` | root | **0** | All workspaces | N/A | `evidence/baseline-commands.txt` |
| `npm run lint` | root | **0** | if-present | N/A | same |
| `npm test` | root | **0** | shared/validation/worker/organizer | Mostly mocked Supabase | same |
| `npm run build:admin` | root | **0** | Next production build | Build-time | same |
| `npm run test:sql` | root | **0** | 26/26 static + live RPC suite | **Live Postgres** | same |

**Note:** Live SQL requires unrestricted host DNS (sandbox DNS previously falsely failed with ENOTFOUND).

## Baseline conclusion (pre-repair this session)

- Compile/lint/unit/admin-build/SQL-live: **PASS**
- Pre-existing uncommitted honesty/incident/E2E fixes present — preserve and extend
- Product defects remain (misleading labels, offline BLE copy, unused MetricCards vs desk UI, etc.) — inventory next
