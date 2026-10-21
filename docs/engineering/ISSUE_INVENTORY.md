# ISSUE_INVENTORY — Confirmed vs Potential

**Baseline commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Inventory time:** 2026-10-21 (deep repair session)

## Confirmed defects (with evidence)

| ID | Sev | Issue | Evidence | Status |
| --- | --- | --- | --- | --- |
| ENG-001 | P1 | Screening “Send Offer” called `confirmWorkerBookingSafe` → DB `confirmed` while UI claimed awaiting acceptance | `apps/organizer/app/shift/screening.tsx`; RPC inserts `confirmed` | **FIXED** — `select_worker_offer_safe` + client |
| ENG-002 | P1 | `application_status` enum lacked `selected_awaiting_confirmation` though TS/UI required it | Live enum query; types in `packages/shared/src/types` | **FIXED** — migration applied |
| ENG-003 | P2 | Revoke offer passed `applicationId` into `cancelBookingSafe` (expects booking id) + fake `org-1` fallback | screening revoke handler | **FIXED** |
| ENG-004 | P2 | Fake job id `job-bkc-vip-01` when shift missing | screening send-offer | **FIXED** — requires real shift |
| ENG-005 | P2 | Finances showed hardcoded PRE-FUNDED / #ESC-BOM-88392 / ₹16,099.20 demo math | `apps/organizer/app/(tabs)/finances.tsx` | **FIXED** — `calculateJobFinancials` |
| ENG-006 | P2 | Admin shift table labeled ESCROW / Fully Funded without bank escrow | `JobModerationTable.tsx` | **FIXED** — LEDGER / Estimate |
| ENG-007 | P2 | Disputes desk showed fabricated geofence/BLE timeline | `DisputesQueue.tsx` hardcoded 09:26–19:34 cards | **FIXED** — honest empty telemetry |
| ENG-008 | P3 | Offline incident notice claimed BLE mesh sync | `safety_incident_service.ts` | **FIXED** |
| ENG-009 | P3 | Onboarding badge “INSTANT UPI ENABLED” without payout rail | `onboarding.tsx` | **FIXED** — UPI ON FILE |
| ENG-010 | P2 | Incident evidence device URIs persisted | Prior verification D-SEC-001 | **FIXED** earlier this branch |
| ENG-011 | P2 | Admin moderation panel hardcoded escrow capital ₹3,130 / “PAYMENT SECURED” | `JobModerationTable.tsx` | **FIXED** — calculator-based wage ledger estimate |

## Potential risks (not fully proven this session)

| ID | Risk | Notes |
| --- | --- | --- |
| RISK-001 | `workerConfirmSelectionSafe` updates bookings via client `.update` not SECURITY DEFINER RPC | Privilege depends on RLS; needs dedicated RPC hardening |
| RISK-002 | Capacity held on offer (`slots_filled++`) may interact with `confirm_worker_booking_safe` if both used | Confirm expects no existing booking; offer creates one — confirm path must not double-count |
| RISK-003 | Mobile Maestro/OTP still NOT RUN | Release blocker for full GO |
| RISK-004 | Escrow wording may remain in older docs/notifications category labels | Worker notifications still has category id `escrow` mapped to “Payouts” |

## Unresolved questions

- Should organizer ever call immediate `confirm_worker_booking_safe` without worker accept? Crew screens may still need an explicit “force confirm” admin/org path — document product rule before changing confirm RPC.
