# PRODUCTION BASELINE

**Timestamp (UTC):** 2026-10-21T07:55:49Z  
**Commit:** `5722d4ec196465a639ab7a4a4d106254cfc32133`  
**Branch:** `main` (tracks `origin/main`, clean at capture)  
**Node / npm:** `v26.11.1` / `11.20.0`

## Topology (from filesystem)

| Path | Role |
| --- | --- |
| `apps/worker` | Expo worker mobile |
| `apps/organizer` | Expo organizer mobile |
| `apps/admin` | Next.js 15 admin web |
| `packages/shared` | Supabase clients, RPCs, services |
| `packages/design-system` | RN UI |
| `packages/validation` | Zod schemas |
| `supabase/migrations` | Postgres + RLS + RPCs |
| `scripts/` | SQL tests, feature check, deploy helpers |
| `.maestro/` | Mobile E2E YAML (device required) |

**Auth/DB:** Supabase GoTrue + Postgres + Storage  
**Package manager:** npm workspaces + `package-lock.json`  
**Mobile deploy config:** `eas.json` present in worker/organizer  
**No Dockerfile / vercel.json** observed at repo root

## Environment (names only)

| Variable | In `.env.example` | Local presence |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | PRESENT |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | PRESENT |
| `EXPO_PUBLIC_APP_ENV` | yes | PRESENT |
| `EXPO_PUBLIC_DEFAULT_CITY` | yes | PRESENT |
| `EXPO_PUBLIC_DEFAULT_TIMEZONE` | yes | PRESENT |
| `NEXT_PUBLIC_APP_URL` | yes | PRESENT |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | PRESENT |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | PRESENT |
| `NEXT_PUBLIC_APP_ENV` | yes | PRESENT |
| `NEXT_PUBLIC_DEFAULT_CITY` | yes | **MISSING** |
| `NEXT_PUBLIC_TIMEZONE` | yes | **MISSING** |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | PRESENT |
| `DATABASE_URL` | yes | PRESENT |
| `ALLOW_DIRECT_ORGANIZER_REGISTRATION` | no | not required (fail-closed when unset) |

## Fresh commands

| Command | Exit | Summary | Mocks/Live | Evidence |
| --- | --- | --- | --- | --- |
| `npm run typecheck` | **0** | Workspaces OK | N/A | `evidence/baseline-commands.txt` |
| `npm run lint` | **0** | if-present OK | N/A | same |
| `npm test` | **0** | shared/validation/worker/organizer | Mostly mocked | same |
| `npm run build:admin` | **0** | Next production build | Build | same |
| `npm run test:sql` | **0** | 26/26 + live RPC suite | **Live Postgres** | same |
| `node scripts/check_all_features.mjs` | **0** | 11/11 | Mixed | same |

### Explicitly NOT RUN

| Check | Reason |
| --- | --- |
| Maestro device E2E | No simulator session |
| Live SMS OTP delivery | Carrier/provider not exercised as delivery proof |
| Push FCM/APNs delivery | Not configured for proof |
| Production deploy | No authorization / no CI deploy this session |
| Bank/payment rails | Not integrated (honest absence) |

## Baseline conclusion

Compile, unit, admin build, live SQL, and platform check scripts are green. Mobile device E2E, SMS OTP proof, push, and real production deploy remain unverified. Missing `NEXT_PUBLIC_DEFAULT_CITY` / `NEXT_PUBLIC_TIMEZONE` in local env (defaults may exist in code).
