# API_AND_DATABASE_MATRIX

**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Method:** Source inspection of `packages/shared/src/supabase/*` + `supabase/migrations` + SQL static script.  
**Live RPC execution:** **BLOCKED** (DB DNS failure).

## Client-facing / shared RPC wrappers (representative)

| Client function | RPC / table | Auth expected | Authz notes (SRC) | Validation | Idempotency | Live status |
| --- | --- | --- | --- | --- | --- | --- |
| `signInWithPhoneOtp` / `verifyPhoneOtp` | Supabase Auth | phone | Auth provider | rate helpers in auth.ts | resend cooldown | **NOT RUN** |
| `applyForJobSafe` | `apply_for_job_safe` | worker session | fail-closed on RPC error | server | — | **BLOCKED** |
| `confirmWorkerBookingSafe` | `confirm_worker_booking_safe` | organizer | server | overlap guards in migrations (static) | idempotent migration present | **BLOCKED** |
| `createJobSafe` | `create_job_safe` | organizer | server | wage/time/coord checks (static) | duplicate publication guard (static) | **BLOCKED** |
| `checkInWorkerSafe` | `check_in_worker_safe` | worker | geofence/code server | fail-closed | — | **BLOCKED** |
| `checkOutWorkerSafe` | `check_out_worker_safe` | worker | server | fail-closed | — | **BLOCKED** |
| `completeShiftAndApproveAttendance` | `complete_shift_and_approve_attendance` | organizer/admin | server | hours optional | — | **BLOCKED** |
| `cancelBookingSafe` | `cancel_booking_safe` | party | server | slot reopen guards (static) | — | **BLOCKED** |
| `recordNoShowSafe` | `record_no_show_safe` | organizer | server | — | — | **BLOCKED** |
| `disputeBookingSafe` | `dispute_booking_safe` | party | server | — | — | **BLOCKED** |
| `fetchDiscoveryFeed` / `getDiscoveryFeedRpc` | discovery | worker | public jobs view | keyset pagination (static) | — | **BLOCKED** |
| `fetchJobBookings` | `bookings` select | organizer/worker | RLS required | — | — | **BLOCKED** |
| `fetchApplicationsForJob` | `job_applications` | organizer | RLS | — | — | **BLOCKED** |
| `uploadVerificationDocument` | storage bucket | user | restricted path | content-type map | — | **BLOCKED** |
| `resolveVerificationCaseSafe` | admin RPC | admin | admin role | — | — | **BLOCKED** |
| `resolveDisputeSafe` | admin RPC | admin | admin | — | — | **BLOCKED** |
| `fetchAdminDashboardMetrics` | admin metrics | admin | admin | — | — | **BLOCKED** |
| `fetchAuditLogs` | audit | admin | admin | — | — | **BLOCKED** |
| `generateJobInvoiceSafe` | invoice RPC | organizer | immutability when paid (static) | FY sequence (static) | — | **BLOCKED** |
| `submitInvoicePaymentReferenceSafe` | payment ref | organizer | ledger only | — | — | **BLOCKED** |
| `processPaymentWebhookSafe` | webhook | secret | fail-closed | — | — | **NOT RUN** / **N/A** sandbox |
| `sendShiftMessage` | messaging | party | — | — | — | **BLOCKED** |
| `submitSafetyIncidentSafe` | safety reports / queue | reporter | offline queue fallback | validation min lengths | — | **BLOCKED** |
| `registerPushTokenSafe` / `sendNotificationSafe` | notifications | user | — | — | — | **BLOCKED** |

## Admin HTTP

| Route | Auth | Notes | Live |
| --- | --- | --- | --- |
| `GET /` (App Router page) | middleware session + `profiles.role=admin` | SRC | **NOT RUN** |
| `GET /login` | public | BUILD lists | **NOT RUN** UX |
| `POST /api/auth/register-organizer` | see route | BUILD lists | **NOT RUN** |

## Database / migrations

| Item | Observation | Live verification |
| --- | --- | --- |
| Migration files | 31 under `supabase/migrations` | Applied state unknown (**BLOCKED**) |
| `CREATE POLICY` occurrences | ~78 across migrations | Policy effectiveness **BLOCKED** |
| `CREATE OR REPLACE FUNCTION` | ~117 | Body text checked via SQL script invariants |
| SQL invariant script | 26/26 static PASS | Live connect FAIL |

## Selected static invariants (from `test:sql` evidence)

PASS examples (migration text only): disputes direct INSERT policy dropped; booking CSPRNG; public_jobs shields supervisor; job transition validator; double-booking guard; discovery keyset; invoice immutability; India coords; admin role escalation guard; etc. Full list in `evidence/test-sql.txt`.

## Tenant isolation

| Check | Status |
| --- | --- |
| Cross-org job edit | **NOT RUN** live; intended via RPC+RLS |
| Worker reads other worker KYC docs | **NOT RUN**; storage signed URL admin path SRC |
| Admin-only RPCs without role | **NOT RUN** live |

## Storage

| Bucket / path | Purpose | Live |
| --- | --- | --- |
| Verification docs (`uploadVerificationDocument`) | KYC | **BLOCKED** |
| Incident evidence URLs | local URIs may be passed without cloud upload | **NEEDS HUMAN REVIEW** — device file URIs may not persist server-side |
