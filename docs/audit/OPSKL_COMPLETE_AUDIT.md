# OPSKL — COMPLETE CODEBASE, PRODUCT & PRODUCTION AUDIT

**Audit Date:** October 20, 2026  
**Auditor:** Joint Technical Due-Diligence Team (Software Architecture, Application Security, Marketplace Product & Financial Integrity Specialists)  
**Target Repository:** `Coderaryanyadav/OpsklTest` (Monorepo root: `/Users/aryan/Desktop/PROJECTS/OPSKIL`)  
**Commit/Tree State:** Clean working tree, Monorepo v0.1.0  
**Target Applications:** Opskl Worker (Mobile), Opskl Organizer (Mobile), Opskl Admin (Web)  
**Priority Hierarchy:** Security & Data Integrity → Business Workflow Correctness → Financial Correctness → Reliability → Usability → Performance → Maintainability → Visual Polish  

---

## 1. EXECUTIVE ASSESSMENT & MATURITY SCORECARD

Opskl is an ambitious, dual-sided, on-demand event staffing marketplace engineered for the Indian metropolitan market (launching in Mumbai). The product architecture features native iOS and Android clients (built on React Native, Expo SDK 52/57, and Expo Router), an administrative governance portal (Next.js 15 App Router), a PostgreSQL 15 database hosted on Supabase with extensive Row-Level Security (RLS) policies, and shared TypeScript domain packages (`@opskil/shared`, `@opskil/validation`, `@opskil/design-system`).

### 1.1 Objective Maturity Evaluation Rubric

Each category is evaluated on an evidence-based 5-level maturity rubric:
- **Level 1 (Ad-Hoc / Prototype):** Hardcoded mocks, client-side only security, frequent breaking bugs, unverified logic.
- **Level 2 (Developing):** Core schema and endpoints exist, but critical failure modes, security bypasses, or missing backend integrations remain.
- **Level 3 (Functional / Pre-Production):** Functional ACID database workflows, automated unit tests, consistent UI tokens, but operational blindspots or unautomated financial/storage steps exist.
- **Level 4 (Hardened / Launch-Ready):** Full server-side authorization, strict state machines, real external integrations, automated CI/CD, production observability.
- **Level 5 (World-Class / Enterprise):** Zero-downtime migrations, automated fraud detection, formal audit compliance, resilient multi-region scalability.

| Dimension | Assessed Level | Status | Primary Strengths | Critical Weaknesses & Blockers |
| :--- | :---: | :---: | :--- | :--- |
| **Engineering & Architecture** | **Level 3** | Functional | Clean monorepo structure; 100% strict TypeScript typecheck passes across all 6 workspaces; shared validation schemas. | Mobile discovery does not use the server keyset RPC; PostgREST URL length overflow risk; duplicate state representations. |
| **Product & Marketplace Logic** | **Level 2.5** | Developing | Atomic booking locks (`SELECT ... FOR UPDATE`); schedule overlap conflict checks; worker cancellation penalties. | **`validate_job_transition` blocks partially-filled shifts from ever starting or completing (`FLOW-001`);** supervisor cannot complete shifts if worker forgot check-out. |
| **Application Security & Privacy** | **Level 2** | High Risk | SQL search paths pinned; strict logging sanitization (JWT & DB password redaction); fail-closed RLS on mutations. | **CRITICAL: Public self-registration admin privilege escalation (`SEC-001`); Base `jobs` table exposes supervisor phone/name to `anon` (`SEC-002`).** |
| **UI/UX Design Fidelity** | **Level 3.5** | Polished | Apple-inspired monochrome palette; 46 reusable design-system components; minimum 44pt touch targets; WCAG AA tokens. | Verification document upload is stubbed with text strings; zone centroid coordinates break 300m geofencing; `public_organizer_cards` view returns blank host names. |
| **Data & Financial Integrity** | **Level 2.5** | Functional / Manual | 100% pass-through worker wages; 10% platform fee + 18% GST calculation; immutable settled payment records. | **Real payments and payouts are completely unintegrated (manual admin ledger only); hardcoded `is_sandbox = true`; sequence doesn't reset on FY boundary.** |
| **Attendance & Geofencing** | **Level 2** | High Risk | Dynamic 60-second QR token in UI; IST timezone check-in window (opens 2 hours prior). | **Geofence is NOT enforced on the backend RPC (`check_in_worker_safe` computes distance but never rejects out-of-range check-ins); QR token is not cryptographically signed.** |
| **Testing & Verification** | **Level 3.5** | Solid Foundation | 270 unit tests passing; 26 SQL invariant checks passing against live database; brutal platform suite passing. | Playwright E2E lacks server harness; Maestro mobile tests use dummy asserts; zero automated load/concurrency stress tests against pooler. |
| **Production Readiness** | **Level 2** | **NOT READY** | Strong migration discipline (29 sequential migrations); safe trigger guards. | Critical security exploits, missing real KYC document storage, and stubbed payment gateways must be remediated prior to commercial launch. |

---

## 2. PHASE ZERO — REPOSITORY ARCHITECTURE & DEPENDENCY MAP

### 2.1 Monorepo Workspace Topology

The repository operates as an npm monorepo (Node v20+, npm v11+) configured in the root [package.json](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/package.json#L1-L40):

```
opskil/
├── apps/
│   ├── worker/                 # Native iOS/Android Worker App (Expo 52/57, React Native 0.86, Expo Router 4)
│   ├── organizer/              # Native iOS/Android Organizer App (Expo 52/57, React Native 0.86, Expo Router 4)
│   └── admin/                  # Web Governance Portal (Next.js 15.2.0, React 19, @supabase/ssr)
├── packages/
│   ├── shared/                 # Domain types, Supabase client & RPC bindings, formatters, financial calculator
│   ├── design-system/          # Apple monochrome tokens, AuthContext, ThemeProvider, 46 UI components
│   ├── validation/             # Zod schemas for auth, shifts, workers, organizers, GSTIN
│   └── config/                 # Base TypeScript compiler configs
├── supabase/
│   ├── migrations/             # 29 sequential migration files (20261012000000 -> 20261018000004)
│   ├── fix_permissions.sql     # Database least-privilege role permissions script
│   └── full_schema_release.sql # Consolidated release schema (416 KB, 11,553 lines)
├── scripts/                    # Invariant verifiers, migration deployers, diagnostic scripts
└── .maestro/                   # Mobile UI integration flows
```

### 2.2 Shared vs. Application Code Division

- **`@opskil/shared`**: Houses the single authoritative database client ([client.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/client.ts)), domain interfaces ([types/index.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/types/index.ts)), RPC invocation wrappers ([jobs.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/jobs.ts), [admin.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/admin.ts), [payments.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/payments.ts)), financial math ([payments/calculator.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/payments/calculator.ts)), and Realtime subscription handlers.
- **`@opskil/design-system`**: Houses visual tokens ([colors.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/design-system/src/tokens/colors.ts)), cross-platform UI components (Screen, Button, Card, Badge, WageText, Input, Dialog, etc.), and the universal `AuthProvider` ([context/AuthContext.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/design-system/src/context/AuthContext.tsx)).
- **`@opskil/validation`**: Enforces Zod schemas across client forms and server actions ([shift.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/validation/src/shift.ts), [auth.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/validation/src/auth.ts), [worker.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/validation/src/worker.ts)).

### 2.3 Data Communication & Boundary Integrity

```
[Mobile Clients (Worker & Organizer)]
       │ (EXPO_PUBLIC_SUPABASE_URL / ANON KEY)
       ▼
[Supabase PostgREST & Realtime Gateway]
       │
       ├─► Direct Table Queries (Read-Only under RLS: public_jobs, profiles)
       │
       └─► PostgreSQL SECURITY DEFINER RPC Functions
             │ (Atomic Transactions, FOR UPDATE locks)
             ▼
       [Database Tables: jobs, bookings, payment_records, verification_cases]
             ▲
             │ (Service Role Key or Admin Session Cookie)
[Next.js Admin Portal / Edge Functions / Deploy Scripts]
```

---

## 3. MASTER FINDINGS REGISTER

The following register indexes every confirmed vulnerability, architectural defect, workflow gap, financial discrepancy, and usability problem discovered during the audit.

| ID | Category | Finding Summary | Severity | Exact Location & Evidence | User / Business Impact | Recommended Fix | Effort |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| **`SEC-001`** | Security | **Unauthenticated Admin Privilege Escalation via Client Meta Data** | **CRITICAL** | [supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24) | Any attacker can register an account with `data: { role: 'admin' }` and instantly obtain full Superadmin access to the admin portal, worker KYC docs, shift controls, and escrow settings. | Strip `WHEN ... = 'admin'` from `handle_new_user_provisioning()`; enforce that `admin` can only be granted via database migrations or direct PostgreSQL superuser command. | **S** |
| **`SEC-002`** | Security / Privacy | **Direct SELECT on Base `jobs` Table Exposes Supervisor Phone Numbers** | **HIGH** | [supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338) | The `public_jobs` view shields supervisor phone/name, but base `jobs` table has an RLS policy allowing `anon` and `authenticated` to SELECT all columns on open jobs. Attackers can scrape supervisor personal mobile numbers directly. | Restrict base `jobs` SELECT policy to organizer and confirmed workers; force public discovery exclusively through `public_jobs` view or `REVOKE SELECT (supervisor_name, supervisor_phone) ON jobs`. | **S** |
| **`SEC-003`** | Security / KYC | **KYC & GSTIN Document Uploads are Stubbed with Plain Strings** | **HIGH** | [apps/worker/app/onboarding.tsx#L261-L267](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app/onboarding.tsx#L261-L267) and [apps/organizer/app/(tabs)/profile.tsx#L121-L128](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/profile.tsx#L121-L128) | Worker Aadhaar/PAN and Organizer GSTIN uploads construct synthetic ASCII strings (`KYC_EVIDENCE_...`) and upload them as fake PDFs. Neither `expo-document-picker` nor `expo-image-picker` is installed. Admin inspects dummy text files. | Install `expo-image-picker` / `expo-document-picker`; capture real camera/gallery files; read binary bytes via `FileSystem` before uploading to `verification-documents` bucket. | **M** |
| **`SEC-004`** | Security / Attendance | **300m Attendance Geofence is Not Enforced on Backend RPC** | **HIGH** | [supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460) | `check_in_worker_safe` calculates `v_distance` via Haversine and records it in `attendance_records`, but never rejects the check-in if distance > 300m or if coordinates are omitted. A worker can self check-in from home. | Add `IF v_distance > 0.3 THEN RETURN ... OUT_OF_GEOFENCE_RANGE;` in `check_in_worker_safe` for non-supervisor self check-ins. | **S** |
| **`SEC-005`** | Security / Auth | **Direct UPDATE Policy on `job_applications` Left Open** | **HIGH** | [supabase/migrations/20261012000000_initial_schema.sql#L716-L722](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000000_initial_schema.sql#L716-L722) | The policy `Organizers update application status` was never dropped. Malicious organizers can execute direct REST `UPDATE` calls on applications without capacity or booking checks. | Execute `DROP POLICY IF EXISTS "Organizers update application status" ON job_applications;` ensuring all updates route via `update_application_status_safe`. | **XS** |
| **`SEC-006`** | Security / Perf | **Unbounded `listUsers()` Call in Organizer Registration Route** | **MEDIUM** | [apps/admin/src/app/api/auth/register-organizer/route.ts#L49-L50](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/src/app/api/auth/register-organizer/route.ts#L49-L50) | In-memory `adminClient.auth.admin.listUsers()` only retrieves first 50 users and transfers entire user directory over wire. Breaks duplicate detection when users > 50 and leaks directory data into server memory. | Replace `listUsers()` with targeted `adminClient.from('profiles').select('id').eq('email', cleanEmail)`. | **XS** |
| **`SEC-007`** | Security | **Historical Credentials in Past Git Commit `68d09c3`** | **MEDIUM** | Git commit `68d09c3` (acknowledged in `PHASE-1.md`) | Pooler password, service-role key, and default admin password were once committed in `scripts/create_admin.mjs`. | Rotate database pooler password and service-role JWT in Supabase Dashboard; invalidate compromised keys. | **S** |
| **`FLOW-001`** | Workflow | **Partially-Filled Shifts Blocked from Starting or Completing** | **HIGH** | [supabase/migrations/20261015000000_launch_fixes.sql#L590-L602](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L590-L602) | `validate_job_transition` only allows `in_progress` transition from `filled`. If a shift with 5 slots fills only 4, it remains in `open`/`filling` and cannot ever transition to `in_progress` or `completed`. | Update `validate_job_transition` to permit transitions to `in_progress` from `('open', 'filling', 'filled')`. | **XS** |
| **`FLOW-002`** | Workflow | **Supervisor Cannot Complete Booking If Worker Fails to Check Out** | **MEDIUM** | [supabase/migrations/20261012000003_booking_attendance_engine.sql#L64-L67](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000003_booking_attendance_engine.sql#L64-L67) | `validate_booking_transition` disallows `checked_in -> completed`. If worker phone dies or worker forgets check-out, organizer cannot sign off shift completion directly. | Permit `checked_in -> completed` transition when caller is verified organizer or admin (`v_is_supervisor`). | **S** |
| **`FLOW-003`** | Workflow | **Coarse Zone Centroid Coordinates Break Real Venue Geofences** | **MEDIUM** | [apps/organizer/app/(tabs)/create.tsx#L60-L68](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/create.tsx#L60-L68) | Shift creation hardcodes zone centroids (e.g., BKC `19.066, 72.868`). Venues 1km away from centroid will fail 300m check-in geofences. | Integrate Google Places / Mapbox geocoding or allow organizer to pin venue location on map. | **M** |
| **`FLOW-004`** | Workflow / UX | **`public_organizer_cards` View Returns Blank Business Names to Workers** | **MEDIUM** | [packages/shared/src/supabase/jobs.ts#L82-L93](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/jobs.ts#L82-L93) and [supabase/migrations/20261016000000_security_privacy_coordinate_hardening.sql#L367-L380](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261016000000_security_privacy_coordinate_hardening.sql#L367-L380) | `public_organizer_cards` has `security_invoker = true`, but base `organizer_profiles` only allows `id = auth.uid()`. Workers cannot read other organizers' rows, causing cards to show generic 'Event Host'. | Add RLS policy on `organizer_profiles` for authenticated users to view public card projection, or set view to `security_definer`. | **S** |
| **`FIN-001`** | Financial | **Online Payment Gateways (Razorpay/RazorpayX) are Completely Unwired** | **HIGH** | [packages/shared/src/payments/razorpay-provider.ts#L47-L80](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/payments/razorpay-provider.ts#L47-L80) and [apps/organizer/app/(tabs)/finances.tsx#L484-L506](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/finances.tsx#L484-L506) | `RazorpayPaymentProvider` is orphaned code. Organizers have no in-app button to deposit escrow; worker payout button marks `escrow_locked` but dispatches no bank IMPS transfer. Entire financial system is a manual ledger. | Implement Razorpay standard checkout for invoices; wire automated RazorpayX Payouts or document strict manual bank transfer pilot SOP. | **L** |
| **`FIN-002`** | Financial | **Invoice Fiscal Year Numbering (`OPS/YY-YY/XXXXX`) Fails on Year Rollover** | **MEDIUM** | [supabase/migrations/20261015000000_launch_fixes.sql#L2350-L2374](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L2350-L2374) | Uses a single monotonic sequence `invoice_seq`. On April 1st FY rollover, sequence does not reset to 1. Consumed values on rollbacks create gaps, violating Indian GST invoice compliance rules. | Maintain a per-FY sequence table (`invoice_fiscal_sequences`) with row locks or annual sequence resetting trigger. | **M** |
| **`FIN-003`** | Financial | **`is_sandbox = true` Hardcoded in Invoice Generation Migration** | **LOW** | [supabase/migrations/20261015000007_fix_invoice_platform_settings_keys.sql#L137](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000007_fix_invoice_platform_settings_keys.sql#L137) | `generate_job_invoice_safe` hardcodes `is_sandbox = true` into all inserted `organizer_invoices` records. | Set `is_sandbox` dynamically from `platform_settings.is_production_mode`. | **XS** |
| **`PERF-001`** | Performance | **PostgREST Query String Overflow Risk in Mobile Discovery Feed** | **HIGH** | [packages/shared/src/supabase/jobs.ts#L191-L193](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/jobs.ts#L191-L193) | `fetchDiscoveryFeed` queries all past applications and passes `query.not('id', 'in', `(${excludedJobIds.join(',')})`)`. As workers apply to dozens of jobs, URL exceeds HTTP header limits (>4KB) causing HTTP 414/431 crashes. | Switch mobile `useDiscoveryFeed` hook to call `getDiscoveryFeedRpc`, which performs exclusions inside PostgreSQL. | **S** |
| **`PERF-002`** | Performance | **Admin Portal Waterfall Query on Initial Mount** | **MEDIUM** | [apps/admin/src/app/page.tsx#L118-L130](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/src/app/page.tsx#L118-L130) | Mount triggers 8 parallel queries + 2 directory queries fetching up to 100 workers/organizers regardless of active module. | Lazy load data only for the active tab module; paginate directory queries server-side. | **M** |
| **`PERF-003`** | Reliability | **Background Push Notifications Not Delivered When Apps are Closed** | **HIGH** | [packages/shared/src/notifications/expo-push.ts#L54-L107](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/notifications/expo-push.ts#L54-L107) | `sendExpoPushBatch` is defined but uncalled by any trigger or webhook. When workers or organizers close the app, database notification inserts do not generate OS push banners. | Deploy a Supabase Database Webhook or Edge Function on `notifications` table INSERT that calls `sendExpoPushBatch`. | **M** |
| **`UX-001`** | UX / Branding | **Branding Inconsistencies in Mobile Manifests vs. Monochrome System** | **LOW** | [apps/worker/app.json#L32](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app.json#L32) and [apps/organizer/app.json#L32](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app.json#L32) | Worker `app.json` has `#0F766E` (emerald) and organizer has `#0F172A` (slate blue), contradicting the Apple-inspired `#000000` monochrome identity in `Design.md`. | Standardize `app.json` splash and adaptive icon backgrounds to `#000000` and `#FFFFFF`. | **XS** |
| **`UX-002`** | UX | **Unverified Worker Experience Lacks Clear Guidance on Shift Detail** | **MEDIUM** | [apps/worker/app/shift/[id].tsx#L121-L136](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app/shift/%5Bid%5D.tsx#L121-L136) | Shift detail shows active "Express Interest / Apply" button to unverified workers; tapping it results in a cryptic alert failure `[KYC_NOT_VERIFIED]` without a direct link to submit KYC. | Disable button for unverified workers with banner: "KYC Verification Required to Apply — Complete Profile", linking directly to onboarding. | **S** |
| **`TEST-001`** | DevOps / QA | **Database Self-Signed Certificate Rejection in Feature Health Script** | **LOW** | [scripts/check_all_features.mjs#L155](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/scripts/check_all_features.mjs#L155) | `check_all_features.mjs` fails Step 8 because `DATABASE_SSL_REJECT_UNAUTHORIZED` defaults to true against Supabase pooler's intermediate certificate. | Add fallback `{ rejectUnauthorized: false }` matching `test_sql_integration.mjs`. | **XS** |
| **`TEST-002`** | QA / CI | **Playwright E2E Configuration Lacks Dev Server Auto-Start** | **LOW** | [apps/admin/playwright.config.ts#L11-L14](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/playwright.config.ts#L11-L14) | Running `npm run test:e2e:admin` fails if Next.js dev server is not already started in a background terminal. | Add `webServer: { command: 'npm run dev', port: 3000, reuseExistingServer: true }` in `playwright.config.ts`. | **XS** |

---

## 4. PHASE ONE — PRODUCT & BUSINESS LOGIC AUDIT

Opskl is designed as a high-velocity, single-day event staffing marketplace. Our audit traced all three user personas from initial onboarding to final settlement.

### 4.1 End-to-End Workflow & State Machine Analysis

#### A. Shift Lifecycle State Machine

```
[draft] ──(publish)──► [open] ──(1+ confirmed)──► [filling] ──(all confirmed)──► [filled]
  │                      │                          │                             │
  │                      ├────────(pause)───────────┴────────(pause)─────────────►│ [paused]
  │                      │                                                        │    │
  │                      ├────────(cancel)──────────┬────────(cancel)────────────►│ [cancelled]
  │                      │                          │                             │
  │                      ▼ (Current Defect: BLOCKED)▼ (Current Defect: BLOCKED)   ▼
  │                      └──────────────────────────┴──────────────► [in_progress]
  │                                                                       │
  └───────────────────────────────(conclude shift)────────────────────────▼ [completed]
```

**State Transition Integrity Finding (`FLOW-001`):**
In [supabase/migrations/20261015000000_launch_fixes.sql](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L590-L602), the validator `validate_job_transition()` defines:
```sql
IF p_current_status = 'filled' AND p_new_status IN ('filling', 'cancelled', 'in_progress') THEN RETURN true;
ELSIF p_current_status = 'in_progress' AND p_new_status = 'completed' THEN RETURN true;
```
If an event organizer posts a shift for 10 workers, but only 8 workers confirm before call time, the job status is `filling` or `open`. At call time, the organizer or system cannot transition the shift to `in_progress` or `completed` because `validate_job_transition('filling', 'in_progress')` returns `false`! This locks partially-filled shifts into an uncompletable limbo.

#### B. Worker Booking State Machine

```
[applied] ──(shortlist)──► [shortlisted] ──(confirm & lock escrow)──► [confirmed]
   │                              │                                       │
   ├──(withdraw)──► [withdrawn]   └──(decline)──► [rejected]              ├──(no-show)──► [no_show]
   │                                                                      ├──(cancel)──► [cancelled]
   │                                                                      ▼
   └──────────────────────────────────────────────────────────────► [checked_in]
                                                                          │
                                                      ┌───────────────────┴───────────────────┐
                                                      ▼                                       ▼
                                                [checked_out]                           [disputed]
                                                      │                                       ▲
                                                      ├─► [completed_awaiting_review] ───────┤
                                                      │                                       │
                                                      ▼                                       │
                                                 [completed] ─────────────────────────────────┘
```

**Attendance Sign-off Deadlock (`FLOW-002`):**
In [supabase/migrations/20261012000003_booking_attendance_engine.sql](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000003_booking_attendance_engine.sql#L64-L67):
`validate_booking_transition('checked_in', 'completed')` is disallowed. If a worker arrives, checks in, works their shift, but forgets to tap "Check Out" on their mobile app before leaving the venue, the organizer's supervisor dashboard cannot sign off on their completion. The booking is stuck in `checked_in`.

---

## 5. PHASE TWO — COMPLETE UI/UX & SCREEN INVENTORY

Opskl's visual target is Apple-grade monochrome discipline: primary black (`#000000`), crisp white (`#FFFFFF`), neutral greys (`#111111`, `#737373`, `#E5E5E5`, `#FAFAFA`), restrained semantic statuses (success `#15803D`, danger `#DC2626`), and zero decorative gradients or gratuitous card layouts.

### 5.1 Worker Mobile App Screen Audit (`apps/worker`)

| Screen / Route | File Location | Observed Behavior | UX Weaknesses & Polish Deficiencies | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **Welcome Tour** | `app/welcome.tsx` | Clean 3-slide value prop carousel with "Browse Shifts" and "Sign In" actions. | Good typography and contrast. Touch targets respect 48dp. | Ready for production. |
| **Login / OTP** | `app/auth/login.tsx` | Clean email OTP input with 30s resend timer and error classification. | Does not provide native SMS/WhatsApp OTP fallback (relies solely on email OTP). | Add SMS OTP provider (Twilio/Gupshup) for workers without active mobile email sync. |
| **Onboarding / KYC** | `app/onboarding.tsx` | Locality multi-select, skills pills, emergency contact, UPI handle, and document input. | **Severe Defect:** Document upload does NOT invoke a camera/file picker. It generates a dummy ASCII text string (`KYC_EVIDENCE_...`). | Integrate `expo-image-picker` to photograph physical Aadhaar/PAN cards. |
| **Shift Discovery (Swipe & List)** | `app/(tabs)/index.tsx` | Dual-mode feed (Tinder-style swipe deck and scrollable list); Mumbai zone filter pills. | **Performance Defect:** Hook passes array of all past job IDs in HTTP query string. | Migrate hook to call `getDiscoveryFeedRpc` with composite keyset pagination. |
| **Shift Detail** | `app/shift/[id].tsx` | Detailed breakdown of shift timings, wage calculation, transit warning, and apply action. | Unverified workers see active "Apply" button and receive cryptic `[KYC_NOT_VERIFIED]` alert upon tapping. | Disable button with clear banner: "KYC Verification Pending". |
| **My Shifts & Attendance** | `app/(tabs)/my-shifts.tsx` | Segmented tabs (Active, Upcoming, Completed); 60-second dynamic attendance QR pass; transit directions. | QR pass string is plain unhashed text; geofence check lacks server rejection. | Cryptographically sign QR code; enforce 300m geofence rejection. |
| **Earnings Ledger** | `app/(tabs)/earnings.tsx` | 6-tier wage breakdown; UPI payout request modal; transaction history. | Alerts worker that "Funds are being processed via UPI IMPS" when no banking gateway is active. | Clarify copy: "Payout request submitted for administrative settlement". |
| **Worker Profile** | `app/(tabs)/profile.tsx` | Trust score, verification status badge, account deactivation/deletion modal, theme toggle. | Clean layout; delete account invokes server deletion RPC correctly. | Ready for production. |
| **Notifications** | `app/notifications.tsx` | Realtime in-app notification center with unread badges and deep linking. | Realtime works only while app is open; no OS push banners received when app is backgrounded. | Wire Supabase database webhook to Expo Push service. |

### 5.2 Organizer Mobile App Screen Audit (`apps/organizer`)

| Screen / Route | File Location | Observed Behavior | UX Weaknesses & Polish Deficiencies | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **Welcome Tour** | `app/welcome.tsx` | Explains vetted crew matching and escrow protection. | Clean Apple monochrome presentation. | Ready for production. |
| **Organizer Login** | `app/auth/login.tsx` | Email OTP and agency workspace sign in. | Clear error categorization. | Ready for production. |
| **Dashboard** | `app/(tabs)/index.tsx` | Active shifts overview, candidate applicant counter, fill rate indicators. | Clean visual hierarchy; metrics load authoritatively. | Ready for production. |
| **5-Step Shift Wizard** | `app/(tabs)/create.tsx` | Role -> Venue -> Duties -> Wages -> Review. Auto-draft persistence in local storage. | **Geofence Defect:** Venue coordinates default to coarse zone centroids (BKC, NESCO) rather than real street addresses. | Add address geocoding via Google Places API to store exact lat/lng. |
| **Applicant Roster** | `app/(tabs)/roster.tsx` | Filter by Applied, Shortlisted, Confirmed, Rejected. One-tap "Confirm & Hire" with capacity lock. | Clean; atomic confirm booking RPC prevents overhiring. | Ready for production. |
| **Shift On-Site Ops** | `app/shift/[id].tsx` | Live shift roster, manual attendance override modal, QR pass scanner, no-show recording. | If worker forgot check-out, organizer has no button to force complete shift. | Add supervisor "Sign-off & Complete Shift" override button. |
| **Finances & Invoices** | `app/(tabs)/finances.tsx` | Staffing tax invoice breakdown (wages + 10% fee + 18% GST); reconciliation logs. | **Missing Action:** "Pay Invoice" button is absent; organizers cannot deposit escrow online. | Integrate Razorpay Checkout modal for direct UPI/NetBanking escrow deposits. |
| **Agency Profile** | `app/(tabs)/profile.tsx` | Business details, GSTIN submission, account deactivation. | GSTIN submission uploads synthetic text token rather than PDF certificate. | Add document picker for GST registration certificate upload. |

### 5.3 Admin Web Console Audit (`apps/admin`)

| Screen / Component | File Location | Observed Behavior | Operational & Security Assessment |
| :--- | :--- | :--- | :--- |
| **Admin Login** | `src/app/login/page.tsx` | Email/password sign-in; checks `role = 'admin'` and active status. | Enforces server-side admin check; purges stale cookies. |
| **Overview & Metrics** | `src/components/MetricCards.tsx` | Gross escrow volume, active disputes, unmoderated shifts, KYC pending. | Authoritative metrics; values are computed dynamically from database. |
| **Verification Queue** | `src/components/VerificationQueue.tsx` | Adjudication queue for worker Aadhaar/PAN and organizer GSTIN with signed URLs. | **Issue:** Evidence viewer opens dummy text strings uploaded by mobile clients. |
| **Shift Moderation** | `src/components/JobModerationTable.tsx` | Living wage enforcement (₹100/hr floor); shift pause/cancellation controls. | Mandatory rejection rationale enforced; operates reliably. |
| **Disputes Queue** | `src/components/DisputesQueue.tsx` | Attendance & wage dispute investigation; adjusted net payout authorizations. | Restores pre-dispute booking status on dismissal; updates escrow cleanly. |
| **Directory Tables** | `src/components/DirectoryTable.tsx` | Searchable directory of workers and organizers; account suspension controls. | Client-side pagination slices only first 100 rows fetched from server. |
| **System Settings** | `src/components/PlatformSettingsPanel.tsx` | Global shift booking killswitch with required administrative rationale. | Synchronizes with `platform_settings` table and audit log. |
| **Audit Logs** | `src/components/AuditLogsTable.tsx` | Immutable ledger of administrative actions, adjudications, and access attempts. | Displays IST timestamps, actor IDs, and JSON state diffs. |

---

## 6. PHASE THREE — SECURITY & PRIVACY AUDIT (THREAT REGISTER)

### 6.1 Threat: Unauthenticated Admin Privilege Escalation (`SEC-001`)
- **Vulnerability Class:** CWE-269: Improper Privilege Management / Mass Assignment via Auth Metadata
- **Severity:** **CRITICAL (CVSS 9.8)**
- **Vulnerable Code Location:** [supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000010_fix_organizer_registration_and_role_switching.sql#L20-L24)
- **Mechanism:** When a user registers via Supabase GoTrue Auth, client-provided `options.data` is stored in `auth.users.raw_user_meta_data`. The database trigger `handle_new_user_provisioning()` contains:
  ```sql
  v_role := CASE
    WHEN (NEW.raw_user_meta_data->>'role') = 'organizer' THEN 'organizer'::user_role
    WHEN (NEW.raw_user_meta_data->>'role') = 'admin' THEN 'admin'::user_role
    ELSE 'worker'::user_role
  END;
  INSERT INTO public.profiles (id, role, ...) VALUES (NEW.id, v_role, ...);
  ```
- **Exploit Preconditions:** None. Public internet access to Supabase anon endpoint.
- **Impact:** Complete compromise of platform governance, access to private KYC documents, ability to divert financial payouts, cancel shifts, and ban users.
- **Remediation:** Remove `'admin'` from `handle_new_user_provisioning()`. Only `'worker'` and `'organizer'` may be self-assigned. Administrator accounts must be explicitly provisioned via internal migration scripts or PostgreSQL command line.

### 6.2 Threat: Base `jobs` Table Exposes Supervisor Personal Phone Numbers (`SEC-002`)
- **Vulnerability Class:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor
- **Severity:** **HIGH (CVSS 7.5)**
- **Vulnerable Code Location:** [supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000003_security_and_privacy_hardening.sql#L335-L338)
- **Mechanism:** Migration 8 created `public_jobs` view to strip `supervisor_name` and `supervisor_phone`. However, migration 11 subsequently added an open RLS policy directly on the underlying `jobs` table:
  ```sql
  CREATE POLICY "Anyone can view open public jobs" ON jobs FOR SELECT TO anon, authenticated
    USING (status IN ('open', 'filling') AND date >= CURRENT_DATE);
  ```
  Because column-level permissions are unrevoked on `jobs`, any caller can execute `supabase.from('jobs').select('supervisor_phone, supervisor_name')` and harvest all event managers' personal telephone numbers without being confirmed on any shift roster.
- **Remediation:** Update base `jobs` SELECT RLS policy so only organizers and confirmed workers can SELECT from `jobs` directly. Anonymous discovery must route exclusively through `public_jobs` view.

### 6.3 Threat: Attendance Geofence Bypass (`SEC-004`)
- **Vulnerability Class:** CWE-284: Improper Access Control (Location Verification Spoofing)
- **Severity:** **HIGH (CVSS 7.1)**
- **Vulnerable Code Location:** [supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261018000000_phase3_auth_kyc_verification_hardening.sql#L440-L460)
- **Mechanism:** In `check_in_worker_safe`:
  ```sql
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_job.latitude IS NOT NULL ... THEN
    v_distance := round((6371 * acos(...))::NUMERIC, 2);
  END IF;
  UPDATE bookings SET status = 'checked_in', ...;
  ```
  `p_lat` and `p_lng` default to `NULL`. If distance exceeds 300 meters or coordinates are null, the function does NOT raise an exception or return failure. It updates the booking to `checked_in` regardless.
- **Remediation:** Enforce that non-supervisor check-ins MUST provide coordinates within 300m (`0.30 km`) of venue coordinates, returning error code `'OUT_OF_GEOFENCE_RANGE'` if violated.

---

## 7. PHASE FOUR — DATABASE & ARCHITECTURE AUDIT

### 7.1 Consolidated Schema vs. Sequential Migrations

The repository maintains 29 sequential migration files in [supabase/migrations/](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations) and a consolidated [supabase/full_schema_release.sql](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/full_schema_release.sql) (11,553 lines).

- **Migration Idempotency:** Deployments are tracked via table `_opskil_migrations` with SHA-256 checksums verified by [scripts/deploy_migrations.mjs](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/scripts/deploy_migrations.mjs).
- **Security Definer Function Hardening:** All 12 core RPC functions have explicit `SET search_path = public, pg_temp` to prevent search-path hijacking attacks.
- **Transaction Isolation:** Multi-step mutations (`confirm_worker_booking_safe`, `apply_for_job_safe`, `admin_resolve_dispute_safe`) execute within atomic transactions utilizing `SELECT ... FOR UPDATE` row-level locks on parent jobs and bookings.

### 7.2 Database Invariant Verification Results

Executed via [scripts/test_sql_integration.mjs](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/scripts/test_sql_integration.mjs) against live PostgreSQL pooler:
- 26/26 Static Migration Invariants: **PASS**
- 12/12 Compiled RPC Function Signatures: **PASS**
- Coordinate Indian Sovereign Boundary Bounds (6°N–38°N, 68°E–98°E): **PASS**
- Living Wage Floor (₹100/hr) Fallback: **PASS**
- Duplicate Shift Publication Throttle Guard: **PASS**
- Admin Role Escalation Safe Guard: **PASS**

---

## 8. PHASE FIVE — FINANCIAL & ATTENDANCE INTEGRITY

### 8.1 Mathematical & Tax Calculation Verification

Opskl's financial engine is specified in [packages/shared/src/payments/calculator.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/payments/calculator.ts#L25-L59):
1. **Worker Wage Guarantee:** 100% of agreed shift wage is disbursed to the worker. Opskl never deducts commissions from workers.
2. **Platform Fee:** Default 10% marketplace intermediary fee charged to the event organizer.
3. **Indian GST (18%):** Levied strictly on the Opskl 10% platform fee, never on the pass-through worker wage component.

**Test Case Calculation (8-hour shift, 5 workers, ₹200/hr = ₹1,600/worker):**
- Total Worker Wages: ₹8,000.00
- Opskl Platform Fee (10%): ₹800.00
- GST on Fee (18% of ₹800): ₹144.00
- Total Invoice Payable by Organizer: ₹8,944.00
- Effective Cost per Worker: ₹1,788.80

*Audit Verification:* Verified against [packages/shared/src/__tests__/payments_and_earnings.test.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/__tests__/payments_and_earnings.test.ts). Math is rounded to 2 decimal places in paise.

### 8.2 Real Integration Reality: Gateway Absence (`FIN-001`)

While the mathematical calculations and database schemas (`organizer_invoices`, `payment_records`, `payment_reconciliation_logs`) are well structured:
- **No Active Online Checkout:** In [apps/organizer/app/(tabs)/finances.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/%28tabs%29/finances.tsx#L484-L506), viewing an invoice displays an itemized statement with a single button: `"Close Invoice Statement"`. There is no gateway modal or payment button.
- **No Automated Worker Payouts:** In [supabase/migrations/20261015000000_launch_fixes.sql#L2540-L2612](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261015000000_launch_fixes.sql#L2540-L2612), `initiate_worker_payout_safe` sets the status to `'escrow_locked'`, but executes no external API call. The funds remain locked until an administrator manually executes a bank transfer outside Opskl and enters a UTR via `admin_mark_payout_settled`.
- **Verdict:** For launch, Opskl must either integrate live Razorpay standard checkout / RazorpayX, or formally document this workflow as a **Manual Escrow Pilot SOP** where organizers pay via NEFT/RTGS to an Opskl nodal account and admin manually marks invoices funded.

---

## 9. PHASE SIX & SEVEN — PERFORMANCE, SCALABILITY & NOTIFICATIONS

### 9.1 Query String Overflow in Discovery (`PERF-001`)

In [packages/shared/src/supabase/jobs.ts#L186-L193](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/supabase/jobs.ts#L186-L193):
```ts
if (excludedJobIds.length > 0) {
  query = query.not('id', 'in', `(${excludedJobIds.join(',')})`);
}
```
`excludedJobIds` combines all shift IDs the worker has applied for or swiped left on. As an active worker interacts with 100+ shifts, the PostgREST URL grows beyond 4,000 characters. Most CDNs, reverse proxies, and browsers truncate or reject requests exceeding 4KB with **HTTP 414 URI Too Long** or **HTTP 431 Request Header Fields Too Large**.
*Solution:* In migration 26, the database function `get_discovery_feed` was added to perform exclusions inside PostgreSQL using subqueries. The mobile hook `useDiscoveryFeed` must be updated to invoke `getDiscoveryFeedRpc`.

### 9.2 Background Push Notification Delivery (`PERF-003`)

The shared package includes a complete Expo push dispatch client in [packages/shared/src/notifications/expo-push.ts](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/notifications/expo-push.ts#L54-L107) (`sendExpoPushBatch`).
However, this function is never invoked anywhere in the repository. When database operations trigger `PERFORM _notify(...)`, a row is inserted into `notifications`. The mobile client receives it via Supabase Realtime websocket *only if the app is currently running in the foreground*. If the worker or organizer has locked their phone or switched apps, no push alert is delivered.
*Solution:* Configure a Supabase Database Webhook or Edge Function on `INSERT` to table `notifications` that calls `sendExpoPushBatch`.

---

## 10. PHASE EIGHT — TESTING & QUALITY ASSURANCE

### 10.1 Executed Automated Test Results

| Test Suite | Commands Run | Status | Tests Executed | Coverage Scope |
| :--- | :--- | :---: | :---: | :--- |
| **Monorepo Typecheck** | `npm run typecheck` | **PASS** | 6/6 workspaces | Complete strict TypeScript typing across all packages. |
| **Shared Unit Tests** | `npm --workspace=@opskil/shared test` | **PASS** | 226 passed | Auth, formatters, marketplace, payments, RLS, audit trail. |
| **Validation Tests** | `npm --workspace=@opskil/validation test` | **PASS** | 7 passed | Phone regex, OTP 6-digit bounds, GSTIN format, wage floor. |
| **Worker App Tests** | `npm --workspace=@opskil/worker test` | **PASS** | 22 passed | Discovery deck, swipe mechanics, navigation states. |
| **Organizer App Tests** | `npm --workspace=@opskil/organizer test` | **PASS** | 18 passed | 5-step wizard validation, roster confirmation idempotency. |
| **Brutal Platform Tests** | `npm run test:brutal` | **PASS** | 17 passed | Living wage floor, CSPRNG booking code, concurrency caps. |
| **SQL Integration Invariants** | `node scripts/test_sql_integration.mjs` | **PASS** | 26 passed | Compiled RPCs, Indian geographic coordinates, admin escalation guard. |
| **Admin Production Build** | `npm --workspace=@opskil/admin run build` | **PASS** | Compiled | Zero leaked secrets in static chunks; Next.js 15 App Router. |

### 10.2 Testing Deficiencies & High-Value Gaps

1. **Playwright E2E Runner Configuration (`TEST-002`):** `apps/admin/playwright.config.ts` points to `http://localhost:3000` but lacks the `webServer` property. Automated test runners in CI fail unless Next.js dev server is spawned manually.
2. **Missing Real Integration Tests for Push & Gateway:** Zero end-to-end tests exist verifying OS push delivery tickets or payment webhook callbacks.
3. **Mobile E2E Tests in `.maestro/`:** Maestro test flows exist for Worker Discovery and Organizer Roster, but contain loose assertions that do not exercise edge failure recovery.

---

## 11. SUMMARY VERDICT & ROADMAP TRANSITION

Opskl demonstrates high engineering competence in database schema design, atomic concurrency serialization, TypeScript rigor, and aesthetic design tokens. The foundation is exceptionally robust compared to typical marketplace prototypes.

However, the application is **NOT production-ready for live customer money or unmonitored public access** due to three blocking security and functional defects:
1. **`SEC-001` (CRITICAL):** Public registration role escalation allows anyone to become a Superadmin.
2. **`SEC-002` (HIGH):** Base `jobs` table exposes event supervisors' personal phone numbers to public scrapers.
3. **`SEC-003` & `FIN-001` (HIGH):** KYC uploads and payment gateways are completely stubbed out with synthetic strings and manual ledgers.

Refer to [docs/audit/OPSKL_IMPROVEMENT_ROADMAP.md](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/docs/audit/OPSKL_IMPROVEMENT_ROADMAP.md) for the prioritized engineering remediation plan.
