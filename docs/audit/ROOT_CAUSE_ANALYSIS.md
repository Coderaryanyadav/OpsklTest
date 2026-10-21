# Opskl Root-Cause Analysis (P0 & P1 Defects)

**Document Date:** October 22, 2026  
**Auditor:** Senior Software Engineer, Database Architect & Application Security Engineer  
**Purpose:** In-depth technical post-mortem and structural analysis of high-severity architectural defects identified and remediated during the brutal bug hunting mission.

---

## 1. RCA-001 [P0 — Security]: Unauthenticated Admin User Management API

### 1.1 Problem Summary
The administrative user mutation API (`POST`, `PUT`, `DELETE` at `/api/admin/users`) allowed anonymous callers to perform privileged user creation, credential setting, profile updates, and account deletions using the service-role client without verifying whether the caller was an authenticated administrator.

### 1.2 Timeline & Discovery Mechanism
- **Discovery:** Static route inspection of `apps/admin/src/middleware.ts` and `apps/admin/src/app/api/admin/users/route.ts`.
- **Finding:**
  ```typescript
  // apps/admin/src/middleware.ts
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||    // <-- Unconditionally bypassed ALL API routes
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    return response;
  }
  ```
  Because Next.js route handlers run server-side, any client could directly curl or fetch `/api/admin/users`. Inside `route.ts`, the handler directly instantiated `getAdminClient()` (`createClient(..., SUPABASE_SERVICE_ROLE_KEY)`) and carried out auth and database updates with zero session validation.

### 1.3 Five Whys Analysis
1. **Why could an anonymous caller create users?** Because `/api/admin/users` executed mutations using the service role without checking who made the request.
2. **Why did `/api/admin/users` not check the user?** Because the developer relied on Next.js middleware to handle all authentication checks before reaching the route.
3. **Why did middleware not protect `/api/admin/users`?** Because the middleware author added `pathname.startsWith('/api')` to avoid redirecting API clients to the HTML `/login` page.
4. **Why was an API-specific auth guard omitted?** Lack of defense-in-depth: route handlers trusted that if they were reached, the environment had already secured them.
5. **Why was actor attribution missing in the audit log?** `logAudit` called `adminClient.from('audit_logs').insert(...)` without an `actor_id` field, making administrative modifications anonymous.

### 1.4 Architecture Correction
- **Middleware Level:** Updated `apps/admin/src/middleware.ts` so that only public API endpoints (`/api/auth`, `/api/health`) bypass authentication. For `/api/admin/**`, middleware extracts the Supabase session and verifies `profiles.role === 'admin' AND is_active = true`. If unauthorized, it returns clean JSON `401 Unauthorized` or `403 Forbidden` responses.
- **Route Handler Level (Defense-in-Depth):** Implemented `verifyAdminAuth(req)` directly in `apps/admin/src/app/api/admin/users/route.ts`. It parses bearer tokens and session cookies via `@supabase/ssr`, checks the database profile, and passes `auth.user.id` to `logAudit`.
- **Failure Recovery:** Implemented rollback logic: if profile or worker/organizer profile insertion fails, the newly created Supabase Auth user and partial profile records are cleanly pruned.

---

## 2. RCA-002 [P1 — Concurrency & Data Integrity]: Capacity Underflow and Drift in `cancel_booking_safe`

### 2.1 Problem Summary
When a booking in `selected_awaiting_confirmation` status was cancelled or declined, `cancel_booking_safe` executed an incremental delta update:
```sql
UPDATE jobs
SET
  slots_filled = GREATEST(0, slots_filled - 1),
  status = CASE WHEN slots_filled - 1 > 0 THEN 'filling'::shift_status ELSE 'open'::shift_status END,
  updated_at = now()
WHERE id = v_booking.job_id;
```
If an uncounted booking was cancelled, or if multiple cancellations raced, `slots_filled` could underflow or drift away from the actual number of workers committed to the shift.

### 2.2 Five Whys Analysis
1. **Why did `slots_filled` drift?** Because the database RPC altered the counter by subtracting 1 rather than deriving the authoritative number from remaining active bookings.
2. **Why was delta decrement used?** It was written as a shortcut under the assumption that every cancelled booking was previously counted in `slots_filled`.
3. **Why is that assumption false?** A booking could be in various non-confirmed states or cancelled multiple times through overlapping client requests, or historical data might have had inconsistent counters.
4. **Why was the status calculation inaccurate?** In PostgreSQL, right-hand side expressions in `UPDATE` reference the row state before the update. Evaluating `CASE WHEN slots_filled - 1 > 0` on an already-zero or unstaffed shift caused status flapping.
5. **Why was this not caught in basic tests?** Unit tests tested single-worker, happy-path confirmations and single cancellations in isolation, rather than concurrent offer declines, sweeps, and multi-slot rosters.

### 2.3 Architecture Correction
- Replaced the delta decrement in `cancel_booking_safe` and `worker_decline_selection_safe` with an authoritative count under row lock:
  ```sql
  SELECT count(*) INTO v_active_slots
  FROM bookings
  WHERE job_id = v_job.id
    AND id <> p_booking_id
    AND status IN ('selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed');

  UPDATE jobs
  SET
    slots_filled = v_active_slots,
    status = CASE
      WHEN v_active_slots >= slots_total THEN 'filled'::shift_status
      WHEN v_active_slots > 0 THEN 'filling'::shift_status
      ELSE 'open'::shift_status
    END,
    updated_at = now()
  WHERE id = v_booking.job_id;
  ```
- This guarantees mathematical consistency regardless of prior state, historical data drift, or race conditions.

---

## 3. RCA-003 [P1 — Timezone & Boundary Logic]: Implicit Session Timezone Bug in `sweep_expired_worker_offers_safe`

### 3.1 Problem Summary
The automated capacity recovery RPC `sweep_expired_worker_offers_safe` declared:
```sql
v_now_ist TIMESTAMPTZ := now() AT TIME ZONE 'Asia/Kolkata';
```
In PostgreSQL, `now() AT TIME ZONE 'tz'` returns a `TIMESTAMP WITHOUT TIME ZONE`. When assigned to a `TIMESTAMPTZ` variable within a session configured to UTC (standard in cloud Supabase poolers), the database engine implicitly converts the wall-clock time as if it were UTC. This introduced an unexpected 5.5-hour time shift.

### 3.2 Five Whys Analysis
1. **Why did offer sweeping behave inconsistently around shift start?** Because the comparison `j.date = v_now_ist::date AND j.start_time <= v_now_ist::time` was evaluated against an implicitly shifted timestamp.
2. **Why was the timestamp shifted?** `v_now_ist` held a UTC interpretation of Indian Standard Time.
3. **Why did the developer write `now() AT TIME ZONE 'Asia/Kolkata'`?** The developer intended to compare dates in the local Indian business day.
4. **Why was string/time extraction used for boundary checking?** Shift dates (`jobs.date` DATE) and start times (`jobs.start_time` TIME) were stored in separate columns rather than combined into a timestamp with time zone instant.
5. **What is the canonical approach?** Constructing the true start instant via `((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata')` and directly comparing it to `now()`.

### 3.3 Architecture Correction
- Rewrote the sweep filter in migration `20261022000000_bug_hunt_capacity_and_auth_hardening.sql`:
  ```sql
  WHERE b.status = 'selected_awaiting_confirmation'
    AND (p_job_id IS NULL OR b.job_id = p_job_id)
    AND (
      b.created_at < (now() - interval '3 hours')
      OR (j.date < (now() AT TIME ZONE 'Asia/Kolkata')::date)
      OR (((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata') <= now())
    )
  ```
- The instant comparison `((j.date + j.start_time) AT TIME ZONE 'Asia/Kolkata') <= now()` operates strictly in true UTC timestamps, completely immune to session timezone differences.
- Grouped swept bookings by `job_id` and recalculated `jobs.slots_filled` authoritatively in a single atomic pass.
