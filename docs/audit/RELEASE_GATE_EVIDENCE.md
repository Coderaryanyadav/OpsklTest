# Opskl Release Gate Evidence Log

**Audit Timestamp:** 2026-10-22T11:51:30+05:30  
**Host Architecture:** Darwin 24.1.0 (arm64)  
**Node.js Version:** `v26.11.1`  
**NPM Version:** `11.20.0`  
**Git Branch:** `main`  
**Git Commit Hash:** `faf10223602a6508d59b4daf526225fedb2e5a44`  
**Lockfile SHA-256 (`package-lock.json`):** `c756b77e613ee5c7ff558a5e3b8c045db3a981f52dbaf57e6528801ee324a32d`  
**Database Engine:** PostgreSQL 15.8 (Supabase Cloud Hosted Pooler — `aws-0-ap-southeast-1.pooler.supabase.com`)  
**Total Sequential Migrations:** 42 Sequential SQL Files  
**Initial Migration:** `20261012000000_initial_schema.sql`  
**Final Migration:** `20261022000003_shared_rate_limiting.sql`  

---

## 1. Automated Release Pipeline Execution & Reproducibility Matrix

All commands executed from monorepo root `/Users/aryan/Desktop/PROJECTS/OPSKIL` against active codebase state:

| Gate # | Verification Gate | Command Executed | Exit Code | Result Summary |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Monorepo Typecheck | `npm run typecheck` | **0** | Found 0 errors across all 6 workspaces (`@opskil/admin`, `@opskil/organizer`, `@opskil/worker`, `@opskil/design-system`, `@opskil/shared`, `@opskil/validation`). |
| **2** | Monorepo Linter | `npm run lint` | **0** | ESLint passed cleanly with 0 errors and 0 warnings across monorepo. |
| **3** | Unit & Integration Tests | `npm test` | **0** | 31 test suites passed, 373 total tests passed (0 failed). |
| **4** | SQL Invariants & Live DB Tests | `npm run test:sql` | **0** | 34/34 static invariants passed; 13/13 core compiled RPC functions verified in PostgreSQL catalog; 20/20 live transaction rollback tests passed. |
| **5** | Platform System Health Audit | `node scripts/check_all_features.mjs` | **0** | 11/11 system checks verified healthy (Read-only safe mode). |
| **6** | Admin Production Bundle | `npm run build:admin` | **0** | Compiled Next.js optimized production bundle in 1.9s. |

---

## 2. PostgreSQL Live Database Catalog & Behavioral Evidence

Executed against active live PostgreSQL test instance with transaction rollback:
```text
✓ Connected to PostgreSQL.
✓ Verified all 13 core security and lifecycle RPC functions compiled in Postgres.
✓ Verified final compiled is_current_admin() in PostgreSQL catalog enforces is_active = true.
✓ Verified register_organizer_direct_safe is completely absent from PostgreSQL catalog.
✓ Verified final compiled worker_confirm_selection_safe() enforces 3h expiry, timezone instants, overnight overlap, and capacity guards.
✓ Verified final compiled generate_job_invoice_safe() strictly denies anonymous callers and bills actual confirmed/attended staffing.
✓ Verified public_jobs view strictly shields supervisor contact details.
✓ Verified public_organizer_cards view strictly shields organizer GSTIN & billing address.
✓ Verified create_job_safe strictly rejects partial coordinate pairs.
✓ Verified create_job_safe strictly rejects non-India geographic coordinates.
✓ Verified unverified organizer live shift creation is rejected by backend RPC (ORGANIZER_NOT_FOUND).
✓ Verified create_job_safe rejects direct creation in non-initial lifecycle statuses.
✓ Verified create_job_safe rejects same-day shifts scheduled after start time.
✓ Verified create_job_safe validates break duration bounds (0-120 mins).
✓ Verified create_job_safe validates venue name and address minimum length.
✓ Verified create_job_safe enforces ₹100 floor when platform_settings min_wage row is missing.
✓ Verified application_deadline and payment_deadline are authoritatively persisted and readable in jobs table.
✓ Verified authoritative payable-hours rule: 8h @ ₹300/hr = ₹2,400 with 45min scheduled break included.
✓ Verified duplicate publication guard blocks identical reposts within throttle window.
✓ Verified prevent_role_escalation strictly blocks unprivileged role tampering.
✓ Transaction rolled back cleanly without permanent mutations.
```

---

## 3. Platform Health Audit Summary (11 Systems Verified)

```text
• Checking Monorepo TypeScript across all 6 packages (@opskil/*)... SUCCESS
• Checking Shared package domain & service unit tests... SUCCESS
• Checking Validation rules, living wage floor, and Zod schemas... SUCCESS
• Checking Worker mobile app component & navigation tests... SUCCESS
• Checking Organizer mobile app component & navigation tests... SUCCESS
• Checking Brutal Platform Launch-Readiness verification suite (17/17 tests)... SUCCESS
• Checking Database SQL schema, RLS, and RPC security invariants... SUCCESS
• Checking PostgreSQL Direct Database Connectivity & Table Audits... SUCCESS
• Checking Supabase Live GoTrue Auth Client & API endpoint reachability... SUCCESS
• Checking Email OTP Dispatch & Rate-Limit Diagnostics... SUCCESS (Safe read-only mode)
• Checking Next.js Admin Dashboard production build compilation... SUCCESS
```

---

## 4. Remediation Evidence for Audit Defect Findings

### Finding 1: Public registration marks email as verified (`email_confirm: true`)
- **Remediation:** Removed automatic confirmation. `adminClient.auth.admin.createUser` explicitly passes `email_confirm: false`.
- **Workflow Protection:** Route is gated via `authorizeWorkflow`: rejects unauthenticated callers with `403 Forbidden` unless caller is an active platform admin, presents valid internal server-to-server API key (`x-admin-internal-key`), or explicit dev opt-in (`ALLOW_DIRECT_USER_REGISTRATION=true`).
- **Client Sign Up:** Client-side public signups in `@opskil/shared` (`signUpWithEmailPassword`) invoke standard `supabase.auth.signUp`, ensuring user mailbox proof-of-control is required.
- **Regression Proof:** `packages/shared/src/__tests__/registration_security_regression.test.ts` proves newly created accounts default to `email_confirm: false` and unverified accounts cannot apply to shifts (`KYC_NOT_VERIFIED`) or publish shifts (`ORGANIZER_NOT_FOUND`).

### Finding 2: Registration rate limiting is process-local and trusts client request header
- **Remediation:** Created migration `20261022000001_shared_rate_limiting.sql` providing table `rate_limit_buckets` and atomic RPC `check_rate_limit_atomic` using row-level upsert locks (`ON CONFLICT (key) DO UPDATE`).
- **IP Spoofing Defense:** Implemented `extractClientIp` inspecting `cf-connecting-ip` / `x-real-ip` first, and extracting the rightmost verified IP from `x-forwarded-for` with strict IPv4/IPv6 validation. Discards malicious header injection.
- **Secondary Defense:** Process-local in-memory sliding-window limiter retained as fast-path first line of defense; falls back automatically if database RPC is unreachable.

### Finding 3: Registration ignores database errors in duplicate lookup
- **Remediation:** `apps/admin/src/app/api/auth/register-user/route.ts` destructures `{ data: existingUser, error: lookupErr }`. If `lookupErr` occurs, the route immediately fails closed with `500` and code `VERIFICATION_UNAVAILABLE` without creating an Auth user.
- **Concurrency Guard:** Concurrent duplicate registration races caught when `createUser` or profile insertion throws unique constraint violation, returning `409` and code `ACCOUNT_EXISTS`.

### Finding 4 & 5: Raw database errors and exception messages exposed to client
- **Remediation:** Generated request correlation ID (`crypto.randomUUID()`). Replaced all internal database details (`${profileErr.message}`, table names, constraint keys) with stable non-sensitive messages and error codes (`PROFILE_INIT_FAILED`, `WORKER_INIT_FAILED`, `ORGANIZER_INIT_FAILED`).
- **Sanitized Diagnostics:** Server-side logging logs detailed technical messages alongside the correlation ID with sensitive data redacted. Outer catch returns generic error message `Registration failed due to a server error. Please try again later.` with code `INTERNAL_SERVER_ERROR`.
