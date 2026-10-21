# PRODUCTION RELEASE CHECKLIST & PRE-FLIGHT VERIFICATION

**Product:** Opskl Platform (Worker App, Organizer App, Admin Dashboard)  
**Target Architecture:** Supabase Postgres + GoTrue Auth + Next.js Admin + React Native (Expo) Mobile  
**Target Market:** Mumbai Event Workforce (BKC, NESCO, Worli, South Mumbai)

---

## 1. Pre-Flight Verification Gates

### Engineering & Build Gates
- [x] Monorepo typecheck clean across all 6 packages (`npm run typecheck` → 0 errors).
- [x] Lint checks pass without errors (`npm run lint` → 0 errors).
- [x] Unit test suites pass completely (`npm test` → 340 / 340 tests PASS).
- [x] Brutal platform launch-readiness suite passes (`npm run test:brutal` → 17 / 17 tests PASS).
- [x] Live PostgreSQL database migrations and RLS policies verified (`npm run test:sql` → 26 / 26 tests PASS).
- [x] Admin Next.js 15 production build compiles without bundle errors (`npm run build:admin` → exit code 0).
- [x] Comprehensive platform check script executes cleanly (`node scripts/check_all_features.mjs` → 11 / 11 PASS).

### Security & Privacy Gates
- [x] Zero service role keys or database connection strings bundled into mobile client code.
- [x] RLS policies enforced on all core tables (`jobs`, `bookings`, `job_applications`, `worker_profiles`, `organizer_profiles`, `disputes`).
- [x] Sensitive fields (passwords, OTP tokens, phone numbers, geo-coordinates) sanitized in client logger.
- [x] Admin dashboard guarded by Next.js middleware checking `role === 'admin'`.
- [x] Worker booking confirmation state machine prevents client-side tampering (requires RPC call `worker_confirm_selection_safe`).
- [x] Immediate freeze of escrow funds when a booking dispute is submitted.

### Regulatory & Living Wage Gates
- [x] Hourly wage floor enforced at schema level (₹100/hr minimum hard stop).
- [x] Mumbai benchmark wage recommendation (₹200/hr) active in job creation wizard.
- [x] 100% upfront escrow locking calculation (Gross Wages + 10% Platform Fee + 18% GST on Fee).
- [x] Worker wage pool zero-deduction guarantee (no hidden platform fee levied on worker stipends).

---

## 2. Manual Configuration & External Owner Actions Required

The following tasks cannot be performed by automated tooling and require manual administrative setup by the Opskl infrastructure owner:

1. **Supabase Custom SMTP Provider (Email OTP / Transactional):**
   - **Current State:** Using temporary `/api/auth/register-user` admin endpoint to bypass unconfigured SMTP error.
   - **Action Required:** In the Supabase Project Dashboard (`Authentication > Email Templates / SMTP Settings`), configure credentials for Resend, SendGrid, or AWS SES to enable native direct email confirmation.

2. **Telecom SMS Gateway (Worker Phone OTP):**
   - **Current State:** GoTrue phone auth reachable, but SMS delivery to physical Indian carrier networks requires SMS gateway credits.
   - **Action Required:** In Supabase Dashboard (`Authentication > Phone Auth`), configure Twilio, MessageBird, or Exotel credentials with an approved DLT-registered SMS template ID.

3. **Production Web & Mobile Store Deployment:**
   - **Admin Dashboard:** Deploy Next.js app to Vercel, AWS ECS, or Render with environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_APP_URL`
     - `DATABASE_URL`
   - **Mobile Apps (Worker & Organizer):**
     - Run `eas build --platform ios --profile production` and `eas build --platform android --profile production` with Apple Developer & Google Play Console service credentials.

4. **Production Banking / Nodal Escrow Rails:**
   - **Current State:** Honest ledger-based accounting; no native ICICI/Razorpay VAN banking hooks exist.
   - **Action Required:** If real-time automated UPI disbursements are desired at launch, connect a RazorpayX or ICICI Nodal Account webhook listener; otherwise, operate under the documented **Ledger-Only / Batch Reconciliation** model.

---

## 3. Rollback & Emergency Runbook

- **Emergency Platform Lockdown:** If malicious shift postings or security incidents occur, trigger the `AdminOverviewDesk` emergency lockdown or run `toggle_emergency_lockdown` RPC in Supabase, which immediately suspends all new shift applications and booking confirmations across the platform.
- **Database Rollback:** If an unverified migration fails, execute the rollback script in `supabase/migrations/rollback/` corresponding to the latest timestamp.
- **Client Cache Clear:** Mobile apps support offline storage wipe through the settings screen if local cache corruption is observed.
