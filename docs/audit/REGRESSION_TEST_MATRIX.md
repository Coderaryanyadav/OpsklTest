# Opskl Regression Test Matrix

**Document Date:** October 22, 2026  
**Status:** 100% Automated & Verified across all test suites

---

## 1. Defect-to-Test Mapping Matrix

| Bug ID | Severity | Defect Description | Test Suite & File | Test Name | Test Type | Command | Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **BUG-001** | **P0** | Unauthenticated Admin User Management API | `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` | `rejects unauthenticated requests with 401 Unauthorized` & `rejects non-admin roles with 403 Forbidden` | Unit / Security Contract | `npm test` | **PASS** |
| **BUG-001** | **P0** | Admin audit log actor attribution & profile rollback | `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` | `guarantees actor attribution in administrative audit logs` & `rolls back user identity if role profile fails` | Unit / Transactional Rollback | `npm test` | **PASS** |
| **BUG-002** | **P1** | Capacity Underflow & Drift in `cancel_booking_safe` | `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` | `recalculates capacity authoritatively when an offer is cancelled` & `never underflows below zero` | Unit / Concurrency Simulation | `npm test` | **PASS** |
| **BUG-002** | **P1** | Exact Derived Capacity Recalculation in PostgreSQL | `scripts/test_sql_integration.mjs` | `3.6 BUG-002: cancel_booking_safe and worker_decline_selection_safe perform exact derived capacity recalculation` | Static & PostgreSQL Catalog Test | `npm run test:sql` | **PASS** |
| **BUG-003** | **P1** | Implicit Session Timezone Bug in Offer Sweep | `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` | `compares shift start instant canonically in Asia/Kolkata timezone` & `expires worker offers older than 3 hours or past shift start instant` | Unit / Timezone Invariant | `npm test` | **PASS** |
| **BUG-003** | **P1** | Canonical Timestamptz Instant Comparison in PostgreSQL | `scripts/test_sql_integration.mjs` | `3.7 BUG-003: sweep_expired_worker_offers_safe compares canonical timestamptz instants and rebalances affected jobs` | Static & PostgreSQL Catalog Test | `npm run test:sql` | **PASS** |
| **BUG-004** | **P2** | Dialer failure handling on non-telephony devices | `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts` | `catches dialer openURL failure and triggers fallback alert` & `rejects empty or corrupt phone numbers` | Unit / Component Resilience | `npm test` | **PASS** |

---

## 2. Platform Verification & Release Gate Execution Matrix

| Gate | Execution Target | Test Suite | Total Checks / Tests | Passed | Exit Code | Environment |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **Gate 1** | Monorepo Types | `npm run typecheck` across 6 packages | All files | All | **0** | Node.js v26.11.1 / TypeScript 5.8 |
| **Gate 2** | Code Quality | `npm run lint` across 6 packages | All files | All | **0** | ESLint / Prettier |
| **Gate 3** | Domain & App Logic | `npm test` (Shared, Validation, Worker, Organizer) | 30 suites (362 tests) | 362 | **0** | Jest Local Unit & Component Sandbox |
| **Gate 4** | Database & SQL | `npm run test:sql` (Static Invariants + Live Postgres) | 33 static checks + 20 live catalog/transaction checks | 53 | **0** | Supabase Hosted PostgreSQL Pooler |
| **Gate 5** | Admin Web Production Build | `npm run build:admin` (Next.js 14 SSR & Static Pages) | Complete application bundle | Complete | **0** | Production Next.js Compiler |
| **Pipeline** | Reproducibility Suite | `./scripts/reproduce_clean_audit.sh` | 5 Gates Combined | 5/5 | **0** | Clean Subshell Execution |
