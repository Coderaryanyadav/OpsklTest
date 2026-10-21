# Opskl Release Gate Evidence Log

**Audit Timestamp:** 2026-10-22T00:06:54+05:30  
**Host Architecture:** Darwin 24.1.0 (arm64)  
**Node.js Version:** `v26.11.1`  
**NPM Version:** `11.20.0`  
**Git Branch / Commit:** `main`  
**Database Engine:** PostgreSQL 15.8 (Supabase Cloud Hosted Pooler)  
**Database Migrations:** 38 Sequential Files (`20261012000000` to `20261021000005`)

---

## 1. Automated Release Pipeline Execution

| Gate # | Verification Gate | Command Executed | Exit Code | Result Summary |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Monorepo Typecheck | `npm run typecheck` | **0** | Found 0 errors across all 6 workspaces (`@opskil/admin`, `@opskil/organizer`, `@opskil/worker`, `@opskil/design-system`, `@opskil/shared`, `@opskil/validation`). |
| **2** | Monorepo Linter | `npm run lint` | **0** | ESLint passed cleanly with 0 errors and 0 warnings. |
| **3** | Unit & Integration Tests | `npm test` | **0** | 29 test suites passed, 351 total tests passed (0 failed). |
| **4** | SQL Invariants & Live DB Tests | `npm run test:sql` | **0** | 31/31 static invariants passed; 20/20 live PostgreSQL catalog & transactional tests passed. |
| **5** | Platform System Health Audit | `node scripts/check_all_features.mjs` | **0** | 11/11 system checks verified healthy (Read-only safe mode). |
| **6** | Admin Production Bundle | `npm run build:admin` | **0** | Compiled Next.js optimized production bundle in 1.4s. |

---

## 2. PostgreSQL Live Database Catalog & Behavioral Evidence

Executed against PostgreSQL test instance with transaction rollback:
```text
✓ Connected to PostgreSQL.
✓ Verified all 12 core security and lifecycle RPC functions compiled in Postgres.
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

## 3. Platform Health Audit Summary (11 Systems)

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
