# Opskl Remaining Blockers

**Date:** 22 October 2026  
**Status:** All confirmed P0/P1 code defects are fixed and covered by local regression tests. The product is **not** cleared for unrestricted real-money production. The following items are either external dependencies, unverified environments, or explicitly accepted residual hardening.

---

## 1. Cannot be verified without production/staging access

### 1.1 Deployed schema and migration state
- **Blocker:** No production/staging Supabase project credentials were available.
- **Unverified:** Whether the deployed database has the same schema as the migration tree; whether all corrective migrations have been applied; whether production RLS policies/grants match the disposable database.
- **Risk:** A migration that passes on a fresh database can still fail or behave differently on a drifted production database.
- **Required action:** Take a schema dump and run the corrective migrations in a staging clone; compare `pg_proc`, `pg_policies`, grants, and table columns against the local replay. Do not apply directly to production without a backup and rollback plan.

### 1.2 Live RLS and role behaviour
- **Blocker:** Local tests simulate PostgREST with `SET ROLE` / `SET SESSION AUTHORIZATION` and JWT claims, but do not exercise the real API gateway, connection pooler, or custom claims.
- **Unverified:** Real `auth.uid()` population, JWT claim propagation, service-role routing, connection-pooler `SET ROLE` semantics.
- **Required action:** Run the negative authorization suite against a staging Supabase project with real JWTs for worker, organizer, admin, deactivated admin, and anon.

### 1.3 Admin E2E
- **Blocker:** `apps/admin/.env.local` points at a remote Supabase project; running the Playwright login/dashboard spec could read or mutate non-disposable data. The spec was therefore not executed. Playwright browsers / a disposable admin session were not available.
- **Unverified:** Login redirect, admin user CRUD, dispute resolution, invoice funding, payout settlement screens end-to-end.
- **Source/build evidence:** Admin login checks `profiles.role='admin' AND is_active=true` before navigation, sanitizes `redirect`, and middleware re-checks the session/profile server-side. `CI=1 npm run build:admin` passes.
- **Required action:** `npm run test:e2e:admin` against a seeded disposable Supabase project with browser binaries.

### 1.4 Mobile login and on-device verification UI
- **Blocker:** No provider credentials (SMTP/SMS/OTP, Google) and no simulator/physical device were available.
- **Unverified:** Worker phone/email OTP entry, Google sign-in, organizer email verification/OTP, organizer worker→organizer switch through the live login screen, camera/document upload, GPS permission prompts.
- **Source evidence:** Worker login routes only `worker`/`admin` profiles and warns on organizer accounts; organizer login calls the now-fixed `switch_user_role_safe`; worker onboarding submits a real `verification_cases` row; admin verification queue calls `admin_verify_case_safe`. The database-backed workflow proves the post-auth provisioning, switch, case submission, and admin approval contracts.
- **Required action:** Test with disposable test identities in a staging project, then a physical-device dry run. Never use real customer OTPs or documents.

### 1.5 Mobile device / simulator behaviour
- **Blocker:** No iOS/Android simulator or physical device run.
- **Unverified:** GPS accuracy, 300 m geofence boundary behaviour, offline queue replay, camera/permissions, dialer fallback, push receipt, app background/foreground transitions.
- **Required action:** Physical dry run at a real venue and TestFlight/Internal Testing builds.

---

## 2. External provider and infrastructure blockers

### 2.1 Real payment rail / escrow is not integrated
- **Current state:** Manual reconciliation only. Organizers submit a bank UTR; an admin marks the invoice funded and later marks a payout settled with a UTR.
- **Not present:** Razorpay Route/Smart Collect escrow, automated bank verification, payout API, refund/reversal automation, reconciliation against a bank statement.
- **Risk:** The ledger can say “settled” while no bank transfer has occurred. The UI now says “manual reconciliation”, but operations must enforce a real bank check.
- **Required action:** Either (a) keep the pilot explicitly manual with a documented dual-control SOP and bank statement reconciliation, or (b) complete Razorpay corporate KYC, activate escrow/Route, configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and test sandbox webhooks before enabling any automated claim.

### 2.2 Production SMS / SMTP / OTP
- **Current state:** Supabase default SMTP sandbox and no production SMS provider.
- **Risk:** Real users may not receive OTP/email; rate limits are unsuitable for a pilot.
- **Required action:** Configure production SMTP (SES/SendGrid/Postmark/Resend) and an Indian SMS provider (Twilio/MSG91), verify deliverability, and keep `TEST_LIVE_OTP=false` in production. Never use real customer phone numbers in test runs.

### 2.3 APNs / FCM push
- **Current state:** No Apple APNs key or FCM credentials configured in Expo EAS; no `EXPO_ACCESS_TOKEN`.
- **Risk:** Push notifications are not delivered on real devices.
- **Required action:** Upload APNs `.p8`, Android FCM credentials, set the Edge Function secret, and test on physical devices.

### 2.4 App store distribution
- **Current state:** EAS build configuration exists; store accounts/signing not verified.
- **Required action:** Link Apple Developer Team ID, configure signing, submit to TestFlight / Google Play Internal Testing.

---

## 3. Operational, legal, and human decisions

### 3.1 Manual reconciliation SOP and dual control
- **Decision required:** Who may mark an invoice funded or a payout settled? The code now restricts this to an active admin and enforces payout state/idempotency, but it cannot verify that a bank transfer actually happened.
- **Required:** Written SOP with maker-checker (two people), bank statement evidence, UTR uniqueness checks, daily reconciliation, and an incident path for wrong/duplicate settlement.
- **Risk without it:** A single admin can record a settlement that never occurred.

### 3.2 KYC/AML and worker classification
- **Decision required:** Legal review of worker onboarding, Aadhaar/PAN handling, GST invoicing, and whether the platform is a marketplace or employer in each jurisdiction.
- **Unverified:** Consent language, data-retention periods, grievance officer, DPDP Act obligations, and whether storing identity documents is lawful/necessary.
- **Required:** Counsel review and a data-protection impact assessment before real user data is collected at scale.

### 3.3 Real customer data / production SQL
- **Constraint:** This audit did not touch real customer data, did not run destructive production SQL, and did not trigger real OTP, payments, or payouts.
- **Required:** Any production migration or data repair must be reviewed, backed up, and executed by authorized operators.

---

## 4. Accepted residual code hardening (P3)

These are catalogued in `BUG_LEDGER.md`; they are not confirmed exploitable under current grants.

1. **`current_user` auth bypass in three legacy RPCs** (`create_job_safe`, `get_organizer_applications_safe`, `sweep_expired_worker_offers_safe`).
   - Current grants are `authenticated`-only and downstream checks still run, so no anon path was found.
   - Risk becomes real if a future migration grants them to `anon` or removes the downstream check.
   - Recommended: replace `current_user <> 'postgres'` with `session_user`/JWT identity and add negative tests.

2. **`submit_review_safe` leaves `opskl.trusted='1'` for the rest of the transaction.**
   - The flag is transaction-local; no cross-request exploit was found.
   - Recommended: reset it immediately after the rating update, as the completion RPC now does.

---

## 5. Verification gaps that are not code defects

- The 52-check full-workflow suite proves database/RPC behavior for worker, organizer, and admin, but not login UI, OTP delivery, camera/GPS, or browser rendering.
- No load test, soak test, or concurrency stress test beyond row-lock functional checks.
- No independent penetration test or threat-model review of the Edge Functions / storage policies.
- No browser/mobile accessibility audit executed (source-level checks only).
- No live provider webhook replay (Razorpay, push, email).
- No disaster-recovery / backup-restore drill.
- No monitoring/alerting validation for failed payouts, reconciliation mismatches, or RLS denials.

---

## 6. Launch gate

| Question | Answer |
| :--- | :--- |
| Are all confirmed P0 defects fixed? | **Yes**, with local database/source regression evidence. |
| Are all confirmed P1 defects fixed? | **Yes**, with local database/source regression evidence. |
| Is unrestricted real-money production approved? | **No.** |
| Is a controlled pilot approved? | **Conditional only** — manual reconciliation, no automated payout claims, staging verification, and the external blockers above must be satisfied. |
| What must happen before a GO? | Staging schema/RLS verification, admin E2E, physical device/GPS test, written reconciliation SOP with dual control, and either a real payment rail or an explicit manual-only pilot decision. |

**Verdict: CONDITIONAL PILOT ONLY.**
