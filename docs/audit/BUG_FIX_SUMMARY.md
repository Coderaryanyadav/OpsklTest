# Opskl Bug Fix & Engineering Summary

**Mission:** OPSKL — Brutal Bug Hunting, Root-Cause Analysis & Automatic Repair  
**Date:** October 22, 2026  
**Auditor:** Senior Software Engineer, Database Architect, Security Engineer & Reliability Engineer  
**Branch:** `main`

---

## 1. Executive Summary

During this mission, the complete Opskl codebase—including the Worker mobile app, Organizer mobile app, Admin web console, shared packages, Supabase migrations, RPC functions, and Edge Functions—was subjected to adversarial inspection across worker, organizer, and admin lifecycles. 

Four primary defect areas (8 individual issues) were identified, reproduced, repaired in source code, verified with regression tests, and confirmed against the live PostgreSQL database engine. All 5 release gates now pass with exit code 0.

---

## 2. Summary of Changed Files and Behaviors

### 1. `apps/admin/src/middleware.ts`
- **Behavior Changed:**
  - Removed blanket bypass of `/api` routes.
  - Public access is now strictly restricted to `/api/auth/*` and `/api/health`.
  - Administrative routes (`/api/admin/*`) require an active Supabase session with `role = 'admin'` and `is_active = true`.
  - API failures return structured JSON `401 Unauthorized` or `403 Forbidden` responses rather than redirecting to the HTML login page.

### 2. `apps/admin/src/app/api/admin/users/route.ts`
- **Behavior Changed:**
  - Added `verifyAdminAuth(req)` helper to extract and validate caller identity from session cookies or bearer tokens.
  - Replaced unscalable `auth.admin.listUsers()` pagination with direct case-insensitive unique lookup on `profiles`.
  - Cleaned up hardcoded `city: 'Mumbai'` to dynamically prioritize user-provided location or fallback city.
  - Added rollback mechanics: if role-specific profile (`worker_profiles` or `organizer_profiles`) creation fails, the auth user and profile row are cleaned up and a 500 error is returned (never false success).
  - Ensured every admin action records `actor_id: auth.user.id` in `audit_logs` for non-repudiation.

### 3. `supabase/migrations/20261022000000_bug_hunt_capacity_and_auth_hardening.sql`
- **Behavior Changed:**
  - **`cancel_booking_safe`**: Replaced delta decrement (`slots_filled - 1`) with an authoritative recalculation of active bookings under row lock. Eliminates capacity drift and underflow.
  - **`worker_decline_selection_safe`**: Replaced delta decrement with authoritative active booking count.
  - **`sweep_expired_worker_offers_safe`**: Fixed PostgreSQL implicit session timezone bug by using canonical UTC instant comparisons: `(((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata') <= now())`. Batched affected jobs to recalculate capacity authoritatively.

### 4. `apps/worker/src/components/GeofencedCheckInModal.tsx`
- **Behavior Changed:**
  - Added `.catch(...)` error handling to `Linking.openURL('tel:...')` when calling the lead coordinator to prevent unhandled promise rejections on devices without phone dialers.

### 5. `apps/worker/app/(tabs)/my-shifts.tsx`
- **Behavior Changed:**
  - Added error catching and fallback alert for supervisor dialing action in the active shift emergency card.

### 6. `apps/worker/app/shift/[id].tsx`
- **Behavior Changed:**
  - Added error catching and fallback alert for supervisor dialing actions in the shift detail briefing card.

### 7. `scripts/test_sql_integration.mjs`
- **Behavior Changed:**
  - Added checks 3.6 and 3.7 to verify that `cancel_booking_safe` and `sweep_expired_worker_offers_safe` enforce derived capacity recalculation and canonical timestamptz comparisons.

### 8. `packages/shared/src/__tests__/bug_hunting_and_capacity_regression.test.ts`
- **Behavior Changed:**
  - Added 9 unit and contract regression tests verifying admin API authentication rejection, non-admin role rejection, audit actor attribution, profile rollback, derived capacity maintenance, shift start timezone instant comparisons, and phone dialer failure resilience.

---

## 3. Release Gate Verification Summary

```text
======================================================================
  REPRODUCIBILITY AUDIT SUMMARY
======================================================================
  Typecheck:               Exit Code 0
  Lint:                    Exit Code 0
  Unit & Integration:      Exit Code 0
  SQL Catalog & Invariants:Exit Code 0
  Full Platform Audit:     Exit Code 0
======================================================================
>>> VERDICT: 100% PASS - ALL VERIFICATION SUITES PASSED CLEANLY.
```
