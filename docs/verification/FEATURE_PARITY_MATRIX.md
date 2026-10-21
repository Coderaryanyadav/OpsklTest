# FEATURE_PARITY_MATRIX

**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Legend:** VERIFIED (fresh live+assertions) · PARTIAL · UI_ONLY · BACKEND_ONLY · MISSING · BLOCKED · N/A · BROKEN

Evidence classes used: **SRC** source, **UNIT** mocked Jest exit 0, **BUILD** admin build, **SQL-STATIC** migration text invariants, **LIVE** runtime against services.

| Feature | Apps | Status | Locations | Evidence | Severity gap | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- |
| Monorepo typecheck | all | **PARTIAL→PASS compile** | workspaces | UNIT/B-TC exit 0 | — | Not a product feature |
| Worker phone OTP | worker | **BLOCKED** live | `auth/login.tsx`, shared auth | SRC + UI honesty | P1 | Live SMS gateway / carrier not exercised |
| WhatsApp OTP | worker | **N/A / honest unavailable** | login UI | SRC | — | Correctly labeled not wired |
| Worker profile + skills | worker | **PARTIAL** | onboarding, profile | SRC | P2 | Live persistence **NOT RUN** |
| KYC document upload | worker | **PARTIAL** | `uploadVerificationDocument` | SRC + UNIT | P1 | Live storage/RLS **BLOCKED** |
| KYC admin approve/reject | admin | **PARTIAL** | VerificationQueue, resolve RPC | SRC + UNIT | P1 | Live admin action **NOT RUN**; OCR theater removed |
| Discovery feed | worker | **PARTIAL** | `fetchDiscoveryFeed` / RPC | SRC + UNIT | P1 | Live DB **BLOCKED** |
| Filters / search | worker | **PARTIAL** | FilterSheet, index | SRC | P2 | Option matrix not live-tested |
| Apply for job | worker | **PARTIAL** | `applyForJobSafe` | SRC + UNIT | P1 | Live apply **NOT RUN** |
| Organizer confirm booking | organizer | **PARTIAL** | `confirmWorkerBookingSafe` | SRC + UNIT | P1 | Live **NOT RUN** |
| Worker confirmed shift view | worker | **PARTIAL** | shift/[id], bookings | SRC | P1 | Live **NOT RUN** |
| Geofenced check-in | worker | **PARTIAL** | GeofencedCheckInModal, RPC | SRC + UNIT | P1 | Live GPS/RPC **NOT RUN**; QR not protocol |
| Organizer attendance console | organizer | **PARTIAL** | attendance + bookings | SRC | P1 | Live **NOT RUN** |
| Attendance ≠ paid | both | **PARTIAL** | copy + complete RPC | SRC + UNIT | P0 product truth | Live payout rail absent by design |
| Earnings ledger | worker | **PARTIAL** | earnings + payments fetch | SRC + UNIT | P1 | No live IMPS/UPI auto settlement |
| Organizer shift create | organizer | **PARTIAL** | create + `createJobSafe` | SRC + UNIT | P1 | Live publish **NOT RUN** |
| Fee calc 10% + GST 18% on fee | shared | **PASS (unit oracle)** | `payments/calculator.ts` | UNIT independent math | — | Live invoice row consistency **NOT RUN** |
| Finances / invoices | organizer | **PARTIAL** | finances.tsx | SRC | P1 | Empty state honest; generate needs live |
| Screening pipeline | organizer | **PARTIAL** | screening.tsx | SRC | P1 | Live applicants **NOT RUN** |
| Crew roster / briefing | organizer | **PARTIAL** | crew.tsx + messaging | SRC | P1 | Live bookings **NOT RUN** |
| Notifications list | worker/org | **PARTIAL** | notifications + shared | SRC + UNIT | P2 | Push delivery **BLOCKED** |
| Incident report | worker | **PARTIAL** | submitSafetyIncidentSafe | SRC | P1 | Live insert **NOT RUN** |
| Offline queue | worker | **PARTIAL** | offline queue service | SRC + UNIT | P2 | BLE mesh **MISSING** (honest) |
| Emergency pause / killswitch | admin/worker | **PARTIAL** | EmergencyLockdownModal | SRC + UNIT | P0 if broken live | Live pause enforcement **NOT RUN** |
| Admin authz middleware | admin | **PARTIAL** | middleware.ts | SRC | P0 if bypassed | Live non-admin probe **NOT RUN** |
| Admin queues | admin | **PARTIAL** | Verification/Disputes/Jobs | SRC + BUILD | P1 | Playwright **NOT RUN** |
| Audit logs | admin | **PARTIAL** | fetchAuditLogs → overview | SRC | P2 | Live **NOT RUN** |
| ICICI VAN / nodal escrow | — | **MISSING** | honest copy across apps | SRC | — | External banking |
| UIDAI AUA / OCR | — | **MISSING** | VerificationQueue honesty | SRC | — | External |
| RLS policies exist | DB | **PARTIAL** | migrations (~78 POLICY refs) | SQL-STATIC | P0 if misconfigured | Live policy probe **BLOCKED** |

## Counts (feature rows above)

| Status | Count (approx) |
| --- | --- |
| PASS (fresh, strong) | 1 (fee calculator unit) + compile/lint/unit/build checks |
| PARTIAL | majority of product features |
| BLOCKED | live DB, live OTP, live push |
| MISSING | bank VAN, UIDAI OCR, BLE mesh |
| VERIFIED end-to-end multi-app | **0** |

**Do not treat PARTIAL as verified for release.**
