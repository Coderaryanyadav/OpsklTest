# BASELINE — Independent Verification

**Timestamp (UTC):** 2026-10-21T07:33:25Z (session start) / evidence captured same session  
**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Branch:** `feat/stitch-design-to-code-phases`  
**Working tree:** clean (no uncommitted changes at baseline capture)  
**Author (HEAD):** Aryan Yadav `<coderaryanyadav@gmail.com>`  
**HEAD subject:** feat(organizer,worker,admin): wire crew/attendance/screening to live bookings  

## Repository topology (from filesystem)

| Path | Role |
| --- | --- |
| `apps/worker` | Expo / React Native worker app |
| `apps/organizer` | Expo / React Native organizer app |
| `apps/admin` | Next.js 15 admin web |
| `packages/shared` | Supabase clients, RPCs wrappers, services, types |
| `packages/design-system` | RN UI tokens/components |
| `packages/validation` | Zod / schema validation |
| `packages/config` | shared config |
| `supabase/migrations` | SQL migrations (31 files observed) |
| `Design/` | Stitch package (28 screen folders + design-system + architecture MD) |
| `scripts/` | check_all_features, SQL integration, screenshots, push dispatch |
| `.maestro/` | 2 mobile flow YAML files |

**Package manager:** npm workspaces (`package-lock.json` present)  
**Runtimes recorded:** Node `v26.11.1`, npm `11.20.0`

## Environment / secrets (names only — values not printed)

| Variable name (from `.env.example`) | Present in example |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `EXPO_PUBLIC_APP_ENV` | yes |
| `EXPO_PUBLIC_DEFAULT_CITY` | yes |
| `EXPO_PUBLIC_DEFAULT_TIMEZONE` | yes |
| `NEXT_PUBLIC_APP_URL` | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `NEXT_PUBLIC_APP_ENV` | yes |
| `NEXT_PUBLIC_DEFAULT_CITY` | yes |
| `NEXT_PUBLIC_TIMEZONE` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes |

**Local files observed (existence only):** `.env`, `.env.local`, `.env.production`, `.env.production.template` — **P0 hygiene note:** secrets files exist in workspace; ensure they are gitignored (see DEFECT_LOG). Values not inspected/printed.  
**Shell:** `SUPABASE_SERVICE_ROLE_KEY` unset in verifier shell.

## Baseline commands (fresh execution)

| ID | Command | CWD | Exit | Result | Mocks/Live | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| B-TC | `npm run typecheck` | repo root | **0** | All workspace `tsc --noEmit` OK | N/A | `evidence/typecheck.txt` |
| B-LINT | `npm run lint` | repo root | **0** | Workspaces lint if-present; no failures | N/A | `evidence/lint.txt` |
| B-UNIT | `npm test` | repo root | **0** | shared 21 suites / 253 tests; validation 1/7; worker 3/38; organizer 2/31 | **Mostly mocked Supabase RPC** | `evidence/unit-tests.txt` |
| B-ADMIN-BUILD | `npm run build:admin` | repo root | **0** | Next build OK; routes `/`, `/login`, `/api/auth/register-organizer` | Build-time; no live admin login exercised | `evidence/build-admin.txt` |
| B-SQL | `npm run test:sql` | repo root | **1** | Migration invariant static checks **26/26 PASS**; live DB connect **FAIL** `ENOTFOUND aws-0-ap-southeast-1.pooler.supabase.com` | Static SQL text + blocked live | `evidence/test-sql.txt` |
| B-PW-LIST | `npx playwright test --list` (apps/admin) | `apps/admin` | **0** | 5 tests listed in `admin_dashboard.spec.ts` | NOT RUN (list only) | `evidence/playwright-list.txt` |

### Explicitly NOT RUN at baseline

| Check | Reason |
| --- | --- |
| Playwright E2E execution | Not executed; only listed. Needs browser + configured admin session |
| Expo iOS/Android device/simulator runs | No simulator session in this verification environment |
| Maestro flows | YAML present; not executed |
| Live Supabase RPC smoke (apply/check-in/confirm) | Live DB hostname unresolved |
| Live SMS OTP / WhatsApp / NPCI / UIDAI | External; not configured for this audit |
| Production payment rails | Forbidden by charter; not attempted |

## Test inventory notes

- Unit/integration Jest suites heavily use `jest.mock` of Supabase client/`__mockRpc` (~134 mock references across test trees).
- Shared “e2e_scenarios” / “e2e_marketplace_lifecycle” names are **in-process Jest scenarios**, not multi-app runtime E2E.
- Admin middleware (`apps/admin/src/middleware.ts`) enforces session + `profiles.role === 'admin' && is_active` when Supabase URL/anon key are configured (source inspection).

## Baseline conclusion (pre-remediation)

| Area | Status |
| --- | --- |
| Compile / typecheck | **PASS** |
| Lint | **PASS** (workspace if-present) |
| Unit tests (mocked) | **PASS** (329 tests across packages/apps as aggregated) |
| Admin production build | **PASS** |
| Live SQL / DB | **BLOCKED** (DNS/connectivity) |
| Device/browser E2E | **NOT RUN** |
| Stitch visual parity | Deferred to Phase 1 inventory (source+folder inspection only at this stage) |

**No application code was modified during baseline capture.**
