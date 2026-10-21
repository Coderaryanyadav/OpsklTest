# FEATURE AND ROUTE INVENTORY

**Commit:** `5722d4e` · Cross-ref: `docs/verification/SCREEN_AND_ROUTE_INVENTORY.md`, `FEATURE_PARITY_MATRIX.md`

## Worker (Expo Router)

| Area | Routes (representative) | Status |
| --- | --- | --- |
| Auth | `auth/login` | PARTIAL — UI + GoTrue; live SMS delivery NOT RUN |
| Onboarding / KYC | `onboarding`, verification uploads | PARTIAL — storage wired; admin decision live NOT RUN device |
| Discovery | `(tabs)/index`, filters | PARTIAL — RPC unit + SQL; device E2E NOT RUN |
| Apply | shift detail → apply | PARTIAL |
| My shifts / offer accept | `(tabs)/my-shifts` | PARTIAL — RPC accept/decline now server-side |
| Attendance | GeofencedCheckInModal | PARTIAL — geofence code; QR not protocol |
| Earnings | `(tabs)/earnings` | PARTIAL — ledger UI; no bank rail |
| Incidents | `incident/report` | PARTIAL — upload + insert; admin review live NOT RUN |
| Offline | `offline` | PARTIAL — queue real; BLE absent (honest) |
| Emergency | `emergency` | PARTIAL — killswitch shared |

## Organizer

| Area | Status |
| --- | --- |
| Create / publish | PARTIAL — `create_job_safe` live SQL verified |
| Screening / offer | PARTIAL — `select_worker_offer_safe` (not instant confirm) |
| Crew / attendance | PARTIAL — live bookings; QR/OT not wired (honest) |
| Finances | PARTIAL — calculator + invoices; no VAN escrow |
| Roster metrics | PASS honesty — no demo padding |

## Admin

| Area | Status |
| --- | --- |
| Middleware role gate | PARTIAL — SRC; Playwright login PASS |
| Queues (KYC, disputes, shifts) | PARTIAL — Playwright navigation PASS |
| `/api/health` | PASS (new) — config presence probe |
| `/api/auth/register-organizer` | PASS fail-closed unless allow flag |
| Regional floors edit | N/A — read-only honest stub |

## Classification legend

WORKING VERIFIED · PARTIAL · UI_ONLY · BROKEN · MISSING · BLOCKED · NEEDS_DECISION
