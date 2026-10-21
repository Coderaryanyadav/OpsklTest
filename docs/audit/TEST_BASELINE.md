# Test & Verification Baseline — Opskl

> Audit date: 2026-10-21
> Repository: `/Users/aryan/Desktop/PROJECTS/OPSKIL`
> Branch / commit: `main` / `699a409`
> Environment: macOS (darwin), Node `v26.11.1`, npm `11.20.0`
> Working tree: 5 modified organizer files (uncommitted user work) + this audit's new docs. Application code was not modified.

This document records only commands actually executed and results actually observed. Anything not run is labeled **NOT RUN** with the reason.

---

## 1. Command results summary

| Command | Result | Exit | Notes |
|---|---|---|---|
| `npm test` | ✅ 340 tests passing | 0 | 22+1+3+2 suites; mock-based |
| `npm run typecheck` | ❌ 4 TypeScript errors | 2 | All in uncommitted organizer files |
| `CI=1 npm run build:admin` | ✅ Next.js production build | 0 | 8 routes generated |
| `DATABASE_URL=invalid node scripts/test_sql_integration.mjs` | ⚠️ 26/26 static invariants, live DB failed | 1 | Live failure is expected (ECONNREFUSED) |
| `npm run lint` | **NOT RUN** | — | No lint config verified per workspace |
| `npm run test:e2e:admin` | **NOT RUN** | — | Requires Playwright browsers + running app |
| Mobile runtime / screenshots | **NOT RUN** | — | No simulator/device session |
| `npm run check:all` | **NOT RUN (deliberately)** | — | Sends real email OTPs |
| Live Supabase integration | **NOT RUN** | — | No approved test project/credentials |
| Dependency/CVE scan | **NOT RUN** | — | No audit command executed |
| Load/performance test | **NOT RUN** | — | Out of scope for this pass |

---

## 2. Unit tests

### 2.1 Command
```bash
npm test
```

### 2.2 Result (VERIFIED)
```
@opskil/shared     : 22 suites, 264 tests passed
@opskil/validation :  1 suite,    7 tests passed
@opskil/worker     :  3 suites,  38 tests passed
@opskil/organizer  :  2 suites,  31 tests passed
------------------------------------------------
Total              : 28 suites, 340 tests passed, 0 failed
Exit code: 0
```

### 2.3 What these tests actually cover

**VERIFIED** by reading test files:

- Pure calculation functions (pay, fees, GST, formatters).
- Validation schemas.
- Mocked Supabase RPC call shapes (`expect(rpc).toHaveBeenCalledWith(...)`).
- Component render assertions for worker/organizer screens.
- Pilot metrics math on synthetic fixtures.
- “Brutal” scenario tests that still mock the database.

### 2.4 What they do **not** cover

- No test executes SQL migrations against Postgres.
- No test asserts that a referenced column exists.
- No test asserts RPC parameter compatibility with the client.
- No test exercises RLS with real JWTs.
- No test asserts that a UI failure is surfaced (and several screens force success with `|| true`).
- No test verifies payment provider calls (provider is mocked/absent).

### 2.5 Why 340 passing tests coexist with P0 defects

| Defect | Why tests miss it |
|---|---|
| `check_in_worker_safe` invalid columns | SQL never executed; tests mock `rpc()` success |
| `complete_shift_and_approve_attendance` invalid columns | same |
| Dispute signature mismatch | mock asserts the client's own wrong parameters (`admin_and_trust.test.ts:172-177`) |
| Anon password reset | no security test calls the function with anon role |
| Fake earnings/finance copy | UI tests assert static strings, not data provenance |
| `|| true` false success | tests do not simulate RPC failure |

**Conclusion**: the suite provides regression value for pure logic, but it is not a system test and cannot support “launch ready” claims.

---

## 3. Typecheck

### 3.1 Current worktree (VERIFIED)
```bash
npm run typecheck
# exit 2
```
Errors:
```
apps/organizer/app/(tabs)/_layout.tsx(4,10): error TS2305:
  Module '"@opskil/shared"' has no exported member 'useAuth'.
apps/organizer/app/(tabs)/roster.tsx(28,3): error TS6133:
  'getTodayDateIST' is declared but its value is never read.
apps/organizer/app/(tabs)/roster.tsx(48,3): error TS6133:
  'Users' is declared but its value is never read.
apps/organizer/app/_layout.tsx(18,10): error TS6133:
  'universalStorage' is declared but its value is never read.
```

All four are in files with uncommitted user edits (`git status`). They are therefore **not** evidence of a broken committed baseline; they are work-in-progress. They were left untouched.

### 3.2 Committed baseline
- Earlier in this audit, before the organizer edits advanced, `npm run typecheck` at HEAD exited 0.
- The current failures are localized to the uncommitted guest-browsing/roster changes.
- **INFERRED**: a clean checkout of `699a409` typechecks; the working tree does not.

### 3.3 Significance
- `useAuth` is imported but not exported from `@opskil/shared` in the current code. Either the export was removed or the import is new. This would break the organizer tabs at runtime if bundled.
- Unused imports (`getTodayDateIST`, `Users`, `universalStorage`) are cleanliness issues, not functional.

---

## 4. Admin production build

### 4.1 Command
```bash
CI=1 npm run build:admin
```

### 4.2 Result (VERIFIED)
```
✓ Compiled successfully
✓ Generating static pages (8/8)
Route (app)                                 Size     First Load JS
┌ ○ /                                        36.8 kB  353 kB
├ ○ /_not-found                               992 B   104 kB
├ ƒ /api/auth/register-organizer              128 B   103 kB
├ ƒ /api/auth/register-user                   128 B   103 kB
├ ƒ /api/health                               128 B   103 kB
└ ○ /login                                   1.44 kB  318 kB
+ First Load JS shared by all                103 kB
ƒ Middleware                                 94.8 kB
Exit code: 0
```

### 4.3 Notes
- Build succeeded with CI placeholder environment values; missing production env is **not** caught at build time.
- No runtime smoke test of `/`, `/login`, or API routes was performed.
- The console is a single client-heavy page (353 kB first load).
- Build output includes `.next/` artifacts; not cleaned to avoid altering user environment (harmless).

---

## 5. SQL static invariants

### 5.1 Command
```bash
DATABASE_URL='postgresql://invalid:invalid@127.0.0.1:1/invalid' \
  node scripts/test_sql_integration.mjs
```

### 5.2 Result (VERIFIED)
- Static phase: **26/26 invariant checks passed**.
- Live phase: attempted connection to `127.0.0.1:1`, failed with `ECONNREFUSED` as expected.
- Process exit: `1` (because live phase failed, not because static checks failed).

### 5.3 What the static checks prove
They grep migration text for expected patterns, including:
- trusted bypass in `check_worker_profile_update`,
- dispute reason length,
- CSPRNG booking code,
- `public_jobs` view shielding supervisor contact,
- job lifecycle validator,
- cancellation slot-reopen guard,
- **“Overlapping shift double-booking guard in confirm_worker_booking_safe”**,
- keyset pagination,
- distance column width,
- dispute status restoration,
- FY invoice numbering,
- paid invoice immutability,
- coordinate bounds,
- partial-coordinate rejection,
- initial status restriction,
- deadlines persisted,
- wage fallback,
- same-day past-time rejection,
- break bounds,
- duplicate publication throttle,
- organizer membership authorization,
- admin escalation guard.

### 5.4 What they do not prove
- That any function compiles or executes.
- That the **new** `worker_confirm_selection_safe` has the overlap guard (the static check targets `confirm_worker_booking_safe`, a different/older function). Section 4 of the workflow audit shows the new path lacks it.
- That referenced columns exist (S2/S3/S14 would all pass these greps).
- That grants/RLS are correct in the deployed database.

**Conclusion**: 26/26 is a documentation lint, not an integration test. It creates false confidence when cited as “SQL integration passing.”

---

## 6. Static security checks performed manually

**VERIFIED** (read-only inspection):
- `GRANT EXECUTE ... TO anon` occurrences in migrations.
- RPC signatures vs. client call arguments for admin/dispute, check-in, completion, payout, invoice, offers.
- Table columns in the initial schema vs. columns referenced by later RPCs.
- `CREATE TABLE`/`ALTER TABLE` for `attendance_records`, `bookings`, `organizer_invoices`, `payment_reconciliation_logs`, `invoice_fiscal_sequences`.
- RLS enablement and policies for core tables.
- Edge Function request handling.
- Admin API route authorization.
- UI hardcoded data and no-op handlers.
- Secret file names only; no values printed.

These produced the findings in `LOGIC_SECURITY_DATA_AUDIT.md`. They are static; runtime behavior may differ if the deployed schema diverged.

---

## 7. Not run — and why

| Activity | Reason | Risk of skipping |
|---|---|---|
| Apply migrations to disposable Postgres | No local Postgres/Supabase test project provisioned; creating one alters environment | Cannot confirm functions compile or RPCs execute |
| `npm run check:all` | Sends real email OTPs and may touch live data | Not safe without approved test identities |
| Live Supabase queries | No test project; production would be read/write | Cannot verify RLS/grants |
| Razorpay sandbox payment | No sandbox credentials; would create real orders in test mode | Cannot verify money flow |
| Admin Playwright E2E | Requires browsers/server; no stable env | Cannot verify console flows |
| Mobile simulator/screenshots | No simulator session in this audit | Cannot verify runtime rendering |
| Accessibility audit | Requires device/screen reader | A11y findings remain static |
| Load test | Out of scope | Performance unknown |
| `npm audit` / SCA | Not requested; network-dependent | Dependency CVEs unknown |

---

## 8. Test gap → production risk mapping

| Untested area | Production consequence |
|---|---|
| Attendance RPC execution | Check-in and completion fail 100% (P0) |
| RPC signature contracts | Dispute resolution fails (P1) |
| RLS with real JWT | Possible cross-tenant reads/writes |
| Anon grants | Account takeover path (P0) |
| Payment webhook | Escrow never funded automatically; reconciliation broken |
| Push function auth | Notification abuse |
| UI failure paths | False success, silent data loss |
| Migration replay | Later migrations can override earlier fixes (webhook regression) |

---

## 9. Minimum test harness recommended before any launch claim

1. **Disposable Postgres job** (Supabase local or Docker):
   - apply all 35 migrations in order,
   - assert schema snapshot matches expected columns,
   - call every RPC once with valid and invalid inputs,
   - assert `anon` cannot execute privileged functions.
2. **Contract tests** generated from RPC signatures (e.g. `pg_proc` introspection) compared to client calls.
3. **RLS matrix tests** with JWTs for worker, organizer, staff, admin, anon, suspended admin.
4. **End-to-end happy path** against the disposable DB: create job → offer → confirm → check-in → complete → invoice → payout.
5. **Failure-path UI tests**: mock RPC failure and assert no success toast/local mutation.
6. **Build/typecheck gate** that runs on a clean checkout, not a dirty worktree.

Until #1 exists, no test result in this repository can substantiate a production-readiness claim.

---

## 10. Reproducibility notes

- Test output contains expected error logs from negative-path tests; they are not failures.
- The admin build used `CI=1` and placeholder env; it does not prove production configuration.
- The SQL script’s exit code 1 is from the live phase; the static phase is green.
- No files outside `docs/audit/` were created or modified by this audit.
- Uncommitted organizer changes remain as found.
