# Opskl Production Readiness & Release Gate Status

**Document Purpose:** Authoritative, single source of truth for repository release readiness, audit remediation evidence, and launch gates.  
**Last Updated:** October 21, 2026  
**Target Repository:** `Coderaryanyadav/OpsklTest`  
**Current Git Branch:** `main`  
**Total Sequential Migrations:** 38 (`20261012000000` through `20261021000005`)

---

## 1. Executive Release Gate Verdict

> [!WARNING]
> **VERDICT: CONDITIONAL PILOT / CLOSED SANDBOX ONLY — NO-GO FOR UNRESTRICTED REAL-MONEY PUBLIC LAUNCH**  
>
> All known backend database vulnerabilities, API rate limits, timezone flaws, invoice math, and contract bugs (P0 and P1) have been patched in the repository code and verified against live PostgreSQL catalog and behavioral tests.
>
> However, an **unrestricted public launch with real money** cannot proceed until the following external operational requirements are executed in the deployment environment:
> 1. Production SMS/SMTP gateway credentials configured (replacing sandbox credentials).
> 2. Live Razorpay Escrow/UPI gateway webhook keys verified with actual bank transfers.
> 3. Production Apple APNs / Google FCM certificates linked in Expo push credentials.
> 4. Physical on-device manual QA test on iOS and Android devices under real GPS conditions.

---

## 2. Audit Remediation Evidence Matrix (P0 & P1 Findings)

| Item | Description | Severity | Resolution Implemented | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **P0-1** | Public registration API rate limiting, duplicate scan, and unverified defaults | **Critical** | Replaced `listUsers()` scan with direct database lookup on `profiles`. Added IP and email/phone sliding-window rate limiters. Enforced transactional rollback of auth user on profile creation failure. Removed fake seeded city/skills defaults. | Verified in `apps/admin/src/app/api/auth/register-user/route.ts`. |
| **P0-2** | Offer confirmation timezone reinterpretation & overnight shift overlap | **Critical** | Converted shift start/end to explicit `Asia/Kolkata` timestamptz instants. Added canonical `[start, end]` overlap math handling shifts crossing midnight. Expanded conflict check to all active booking states. | Verified in migration `20261021000005` and `scripts/test_sql_integration.mjs`. |
| **P0-3** | Invoices billed unconfirmed requested capacity; unauthenticated execution | **Critical** | Restricted `generate_job_invoice_safe` to authenticated callers (`UNAUTHENTICATED` error for anon). Rewrote wage calculation to bill actual confirmed/attended workers (`v_billable_slots`) rather than requested capacity. | Verified in migration `20261021000005` and live SQL test suite. |
| **P0-4** | Migration baseline reconciliation schema fingerprint | **Critical** | Upgraded `scripts/deploy_migrations.mjs` to validate table presence, column definitions, RLS enablement, and compiled routines in `pg_proc` before allowing baseline backfill. | Tested and confirmed in `scripts/deploy_migrations.mjs`. |
| **P1-5** | Idempotent offer confirmation revalidation | **High** | `worker_confirm_selection_safe` revalidates parent job status on idempotent calls and returns `JOB_CANCELLED_OR_CLOSED` if job was cancelled. | Verified in catalog and RPC tests. |
| **P1-6** | Atomic `slots_filled` maintenance & capacity limit | **High** | Added row-locked capacity check (`CAPACITY_REACHED`) and atomic `slots_filled = v_confirmed_count + 1` update on `jobs`. | Verified in migration `20261021000005`. |
| **P1-7** | Push notification webhook authentication & payload validation | **High** | Required `WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`. Enforced database-backed verification querying `public.notifications` by ID. Distinguishes `provider_accepted` from `delivered`. Fixed missing environment variable declarations. | Verified in `supabase/functions/dispatch-push-notifications/index.ts`. |
| **P1-8** | Registration role-specific profile error handling | **High** | Inspected `{ error: workerErr }` / `{ error: organizerErr }`. On failure, executes rollback deleting profile rows and deleting the auth user identity. | Verified in `apps/admin/src/app/api/auth/register-user/route.ts`. |
| **P1-9** | Neutral profile initialization | **High** | Worker profiles initialize with empty skills and null localities; organizer profiles initialize with null business type. | Verified in `apps/admin/src/app/api/auth/register-user/route.ts`. |
| **P1-10**| Live database behavioral testing | **High** | `scripts/test_sql_integration.mjs` verifies both static source regex and live PostgreSQL catalog definitions (`pg_proc`, `pg_get_functiondef`, `information_schema`) + transactional RPC rollbacks. | 31/31 static invariants PASS, 21/21 live database tests PASS. |

---

## 3. Clean Monorepo Verification Pipeline

Execute the clean reproducibility script at any time:
```bash
./scripts/reproduce_clean_audit.sh
```

**Recorded Verification Results:**
- **Monorepo Typecheck (`tsc --noEmit` across all 6 workspaces):** Exit Code 0 (0 errors)
- **Monorepo Lint (`eslint`):** Exit Code 0
- **Unit & Integration Tests (`jest` across all workspaces):** Exit Code 0 (28 suites, 340 tests passed)
- **SQL Invariants & Live Catalog Tests (`test_sql_integration.mjs`):** Exit Code 0 (31/31 invariants, 21/21 catalog & transaction tests)
- **Full Platform Health Audit (`check_all_features.mjs`):** Exit Code 0 (11/11 systems healthy)

---

## 4. Superseded Historical Reports
The following historical documents in `docs/audit/` are preserved for provenance but are **superseded** by this document:
- `docs/audit/OPSKL_EXECUTIVE_SUMMARY.md` (Dated Oct 20, 2026 — superseded)
- `docs/audit/AUDIT_SUMMARY.md` (Dated Oct 21, 2026 — superseded)
- `docs/audit/BASELINE.md` (Dated Oct 17, 2026 — superseded)
