# Project Understanding — Opskl

> Audit date: 2026-10-21
> Repository: `/Users/aryan/Desktop/PROJECTS/OPSKIL`
> Branch / commit: `main` / `699a409d15969d6b53490cf6757061d966e07a9d`
> Mode: read-only audit. No application source, schema, RLS, auth, payment, or data files were modified.
> Evidence labels: **VERIFIED** (read directly in source/config or reproduced by a safe command), **INFERRED** (deduced from code paths without execution), **UNKNOWN** (not determinable from the repository).

---

## 1. What the product is

Opskl is a two-sided, temporary/event staffing marketplace for India:

- **Workers** discover event shifts, apply or accept direct offers, check in on site, and receive shift earnings.
- **Organizers** post jobs, screen applicants, confirm crews, run attendance/supervision, and manage invoices/finances.
- **Admins** operate a back-office console for users, organizers, jobs, payments, disputes, and platform health.

The repository also contains a large body of production-readiness documentation that describes the product as launch-ready. Those claims are contradicted by the code and schema evidence summarized in this audit set; see `AUDIT_SUMMARY.md` and `LOGIC_SECURITY_DATA_AUDIT.md`.

**VERIFIED** — Product language is event/exhibition staffing (Mumbai venues, badge desks, ushering, crowd marshalling) in `packages/shared/src/pilot-metrics.ts`, organizer screens, and marketing copy.

---

## 2. Repository topology

**VERIFIED** — npm workspaces monorepo. Root scripts in `package.json`:

| Workspace | Path | Stack | Role |
|---|---|---|---|
| `@opskil/worker` | `apps/worker` | Expo / React Native, Expo Router | Worker mobile app |
| `@opskil/organizer` | `apps/organizer` | Expo / React Native, Expo Router | Organizer mobile app |
| `@opskil/admin` | `apps/admin` | Next.js 15 App Router | Admin web console + 3 API routes |
| `@opskil/shared` | `packages/shared` | TypeScript | Supabase clients, domain logic, payments, notifications |
| `@opskil/validation` | `packages/validation` | TypeScript / Zod | Shared validation schemas |
| `@opskil/design-system` | `packages/design-system` | React Native components | Shared UI primitives |
| `@opskil/config` | `packages/config` | TypeScript config | Shared tooling config |

Backend: **Supabase** (Postgres + RLS + RPCs + Storage + Edge Functions). There is no separate application server for the mobile clients; they call Postgres RPCs and tables directly through `@supabase/supabase-js`.

**VERIFIED** — 35 SQL migrations in `supabase/migrations/` (initial schema 2026-10-12 through capacity sweep 2026-10-21), one Edge Function (`supabase/functions/dispatch-push-notifications/index.ts`), 28 test files across workspaces, and a generated `supabase/full_schema_release.sql` snapshot.

---

## 3. Runtime surfaces

### 3.1 Worker app (16 route files, ~14 user-facing screens)
**VERIFIED** — `apps/worker/app/`:

- Tabs: `index` (discovery), `my-shifts`, `earnings`, `profile`
- Auth/onboarding: `welcome`, `auth/login`, `onboarding`, `offline`
- Shift lifecycle: `shift/[id]`, `shift/checkin`
- Safety: `incident/report`, `emergency`
- Utility: `notifications`, `+not-found`

### 3.2 Organizer app (16 route files, ~14 user-facing screens)
**VERIFIED** — `apps/organizer/app/`:

- Tabs: `index` (dashboard), `create` (post job), `roster`, `finances`, `profile`
- Auth: `welcome`, `auth/login`, `verification`
- Shift lifecycle: `shift/[id]`, `shift/screening`, `shift/crew`, `shift/attendance`
- Utility: `notifications`, `+not-found`

### 3.3 Admin console
**VERIFIED** — Next.js App Router routes built successfully:

- `/` — single-page console
- `/login`
- `/api/auth/register-organizer`
- `/api/auth/register-user`
- `/api/health`

The console is a client-heavy single page (`apps/admin/src/app/page.tsx`) using the shared admin data layer in `packages/shared/src/supabase/admin.ts`.

---

## 4. Domain model

**VERIFIED** — Core tables in the initial schema (`supabase/migrations/20261012000000_initial_schema.sql`) and later migrations:

| Entity | Table | Purpose |
|---|---|---|
| User/profile | `profiles` | Role, name, phone, KYC state, completion status |
| Worker profile | `worker_profiles` | Skills, experience, UPI ID, reliability |
| Organizer profile | `organizer_profiles` | Company, GST, verification |
| Job | `jobs` | Event shift: venue, coordinates, pay, slots, status |
| Application | `job_applications` | Worker → job application, status |
| Booking | `bookings` | Confirmed allocation: worker + job, pay, lifecycle status |
| Attendance | `attendance_records` | Check-in/out, hours, supervisor verification |
| Payment | `payment_records` | Per-booking payout/escrow record |
| Invoice | `organizer_invoices` | Organizer billing / escrow funding |
| Dispute | `disputes` | Worker/organizer disputes and resolution |
| Incident | `incidents` / evidence storage | Safety reports and media |
| Notification | `notifications`, `user_notification_preferences` | In-app + push |
| Audit | `audit_logs` | Actor/action/entity/state trail |
| Platform config | `platform_settings` | Fees, feature flags, pilot configuration |

Roles are represented by `user_role` enum on `profiles` and enforced in RLS via `is_current_admin()` and ownership predicates.

---

## 5. Canonical workflows (as intended)

**VERIFIED / INFERRED** from screens and RPC names:

1. **Worker onboarding**: phone OTP → profile → KYC/documents → skills → UPI → completed.
2. **Organizer onboarding**: phone OTP → company profile → verification → post jobs.
3. **Job posting**: organizer creates job with venue, date/time, headcount, wage, requirements.
4. **Discovery / application**: worker browses jobs → applies (KYC-gated) or receives a direct offer.
5. **Screening**: organizer reviews applicants → selects → confirms booking.
6. **Offer acceptance**: worker accepts/declines a direct offer (`worker_accept_job_offer_safe` / decline variant).
7. **Pre-shift**: reminders, messaging, standby/capacity sweep, cancellation rules.
8. **Check-in**: worker arrives, geofence + check-in code (or supervisor override) → `attendance_records`.
9. **Completion**: supervisor signs off hours → booking completed → payout eligibility.
10. **Billing**: organizer invoice generated/funded → worker payout initiated → settled.
11. **Dispute/incident**: either party raises dispute/incident → admin resolves → audit log.
12. **Notifications**: DB insert → Edge Function dispatch → Expo push.

The actual implemented state transitions diverge materially from this intent. See `WORKFLOW_AND_STATE_MAP.md`.

---

## 6. Money model

**VERIFIED** — `packages/shared/src/payments/calculator.ts` and tests define:

- Worker wage pool = headcount × wage.
- Platform fee billed to the organizer (percentage, with GST treatment).
- Organizer payable = wage pool + platform fee (+ tax) into escrow.
- Worker net payout = agreed/approved pay; the worker does not pay platform fees.

**VERIFIED** — Payment provider abstraction exists (`provider.interface.ts`, `sandbox-provider.ts`, crypto utilities). A Razorpay provider is referenced by tests, but no webhook HTTP endpoint or live provider wiring was found.

**VERIFIED** — In practice, `initiate_worker_payout_safe` only writes/updates a `payment_records` row with status `escrow_locked`; no bank/UPI rail is called. Admin UI manually marks settlement with a UTR. Invoices are always created with `is_sandbox = true`.

**INFERRED** — "Escrow" is a database status, not a regulated escrow account or nodal account integration in this repository.

---

## 7. Identity, authorization, and trust boundaries

**VERIFIED** — Authorization is enforced primarily in Postgres:

- RLS policies on domain tables (see `20261015000001_security_definer_views_and_rls.sql` and later hardening migrations).
- `SECURITY DEFINER` RPCs for multi-table mutations.
- Client sends the user JWT; `auth.uid()` is the actor.
- Admin RPCs guard on `is_current_admin()`.

**Critical trust-boundary observations** (details in `LOGIC_SECURITY_DATA_AUDIT.md`):

- Some privileged RPCs are executable by `anon` (`register_organizer_direct_safe`) and can rewrite an existing user's password — anonymous account takeover.
- `is_current_admin()` checks role but not `is_active`, so suspended admins keep RPC power until JWT expiry.
- Several RPCs rely on caller-supplied IDs/coordinates without ownership checks.
- The push Edge Function has no shared-secret or auth check.
- The admin registration API routes mint accounts without an authenticated admin session.

**UNKNOWN** — Whether the deployed database matches the migration chain. If `fix_permissions.sql` (repository root) was applied after the final migration, the `anon` grant may be revoked in production. Deployment order and actual grants cannot be determined from the repo.

---

## 8. Notifications and realtime

**VERIFIED**:

- `notifications` table + preferences; realtime channel helpers in `packages/shared/src/notifications/`.
- Expo push token registration and dispatch helpers.
- `supabase/functions/dispatch-push-notifications/index.ts` consumes a database webhook payload and sends Expo push messages using a service-role Supabase client.
- The function accepts any POST body and performs no signature/shared-secret validation.

**INFERRED** — Database webhooks must be configured outside the repo (Supabase dashboard). There is no migration that creates the webhook.

---

## 9. Dashboard / metrics layer

**VERIFIED**:

- `packages/shared/src/pilot-metrics.ts` contains `MUMBAI_PILOT_RECORDS` — 18 fully synthetic pilot shifts with venues, wages, fill rates, and dispute counts.
- Killswitch/pilot metric defaults include `99.94%` and `42 ms`.
- Organizer and admin dashboards surface these synthetic values alongside live data without a visible "demo" label in several places.

This matters for product understanding: some "traction" and reliability numbers in the UI are fixtures, not measurements.

---

## 10. Environments and configuration

**VERIFIED**:

- `.env`, `.env.local`, `.env.production` are gitignored; only secret *names* were inspected (no values printed).
- Worker/organizer use `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Admin uses server-side Supabase credentials and a service-role key for registration routes.
- `EXPO_PUBLIC_USE_DEMO_FIXTURES` is declared but referenced by **zero** source files — it is not a functioning switch.
- `scripts/check_all_features.mjs` sends real email OTPs and must not be run without an approved test identity/provider.
- `scripts/test_sql_integration.mjs` supports a static-invariant phase (safe) and a live DB phase (mutating; not run).

**UNKNOWN** — Actual Supabase project configuration (auth providers, SMTP, webhooks, storage buckets, cron jobs, deployed function versions) is not represented in the repo.

---

## 11. Documentation vs. reality

**VERIFIED** — Existing production documents (e.g. `docs/production/FINAL_PRODUCTION_READINESS_REPORT.md`) assert "RLS on all tables", "all mock artifacts removed", and "LAUNCH READY". The code contradicts each:

- `invoice_fiscal_sequences` has no RLS and grants DML to `authenticated`.
- At the audited commit, large UI surfaces render hardcoded shifts, wages, countdowns, and SLAs (the active uncommitted work fixes the roster but not the rest).
- Core attendance RPCs reference nonexistent columns and cannot succeed.
- 340 unit tests pass, but they mock Supabase and never exercise SQL.

Treat prior "ready" conclusions as unverified marketing, not engineering evidence.

---

## 12. How to read this audit set

| Document | Question answered |
|---|---|
| `PROJECT_UNDERSTANDING.md` (this) | What is this system and how is it put together? |
| `WORKFLOW_AND_STATE_MAP.md` | What states exist and where do transitions break? |
| `UI_UX_AUDIT.md` | What do users actually see, and what is fake/confusing? |
| `LOGIC_SECURITY_DATA_AUDIT.md` | What can be exploited or corrupt data, and how severe? |
| `TEST_BASELINE.md` | What was executed, what passed, and what remains unverified? |
| `PRIORITIZED_IMPROVEMENT_PLAN.md` | In what order should this be fixed? |
| `AUDIT_SUMMARY.md` | One-page verdict, top risks, and next safe batch. |

---

## 13. Explicit non-goals / limits of this audit

- No live Supabase, payment, SMS/OTP, or push integration was executed.
- No production data was read or mutated.
- No mobile runtime/screenshot pass was performed; UI findings are static-code findings.
- No penetration test, load test, or dependency CVE scan was run.
- Findings are based on repository text at the stated commit plus the current uncommitted organizer edits, which were left intact.
