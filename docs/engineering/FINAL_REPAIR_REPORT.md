# FINAL_REPAIR_REPORT — Deep Code Audit & Root-Cause Repair

**Session:** 2026-10-21  
**Inspected commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Branch:** `feat/stitch-design-to-code-phases`  
**Preserved prior work:** verification docs, incident evidence upload, admin Playwright env loader

---

## 1. Repository state

| Item | Value |
| --- | --- |
| Package manager | npm workspaces |
| Apps | worker (Expo), organizer (Expo), admin (Next 15) |
| Shared | `@opskil/shared`, design-system, validation |
| Backend | Supabase Auth + Postgres RLS/RPCs + Storage |

Working tree includes repair edits + `docs/engineering/**` + migrations (uncommitted).

---

## 2. Architecture discovered

UI (Expo/Next) → `@opskil/shared` service wrappers → Supabase RPC/tables with SECURITY DEFINER for privileged mutations. Financial authority: `calculateJobFinancials` (10% fee + 18% GST on fee). Booking lifecycle intended: apply → shortlist → **selected_awaiting_confirmation** → worker accept → confirmed.

---

## 3. Baseline failures before this repair slice

Compile/lint/unit/admin-build/SQL-live were already **PASS** at session start (`BASELINE_AUDIT.md`).  
Product defects existed despite green builds (offer≠confirm mismatch, demo finance UI, escrow/BLE theater).

---

## 4. Confirmed issues and root causes

See `ISSUE_INVENTORY.md` / `DEFECT_LOG.md`. Highest impact:

**ENG-001/002:** Screening called confirm RPC and application enum could not express awaiting-offer status — UI lied about lifecycle while DB confirmed workers immediately.

---

## 5. Fixes and changed files

| Area | Files |
| --- | --- |
| DB | `supabase/migrations/20261021000001_select_worker_offer_lifecycle.sql` (applied live) |
| Shared | `packages/shared/src/supabase/jobs.ts` (`selectWorkerOfferSafe`), tests, safety_incident copy |
| Organizer | `screening.tsx`, `finances.tsx` |
| Admin | `JobModerationTable.tsx`, `DisputesQueue.tsx` |
| Worker | `onboarding.tsx`, unit assertion |
| Docs | `docs/engineering/*` |

Also retained prior incident upload + Playwright credential loader from verification remediation.

---

## 6. Exact tests / outcomes

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm run typecheck` | **0** | `evidence/typecheck-after-repair.txt` |
| `npm test` | **0** | `evidence/unit-after-repair.txt` (shared 255 tests incl. offer regression) |
| `npm run test:sql` | **0** | `evidence/sql-after-repair.txt` |
| `npm run test:e2e:admin` | **0** | `evidence/playwright-after-repair.txt` (5/5) |

---

## 7. Before / after (important)

| Defect | Before | After |
| --- | --- | --- |
| Send Offer | `confirm` → confirmed | `select_worker_offer_safe` → awaiting |
| Finances card | Hardcoded ₹16,099 / ESC-BOM | Live calculator or empty |
| Admin shifts col | ESCROW / Fully Funded | LEDGER / Estimate |
| Dispute timeline | Fake BLE events | Honest not-wired |

---

## 8. Security / data integrity

- Offer RPC: authz (owner/admin/membership), KYC gate, capacity hold, audit log, notification.
- Application enum extended to match booking lifecycle.
- Revoke now requires real booking id (no application-id misuse).
- Remaining: `workerConfirmSelectionSafe` still uses client table updates (RISK-001).

---

## 9. Regressions

None detected in typecheck/unit/SQL/admin E2E after changes.

---

## 10. Remaining defects

| ID | Sev | Status |
| --- | --- | --- |
| RISK-001 worker confirm RPC | P1 | OPEN |
| Mobile E2E / live SMS OTP | P1 | NOT RUN |
| Push delivery | P2 | NOT RUN |
| Escrow category naming in worker notifications | P3 | OPEN |

---

## 11. Blocked / untested

- Expo/Maestro device flows  
- Carrier SMS OTP end-to-end  
- Cross-tenant RLS probe suite beyond existing SQL RPC guards  

---

## 12. External integrations not verified

Bank VAN/escrow, UIDAI OCR, WhatsApp/SMS broadcast, FCM/APNs push, BLE mesh (intentionally absent).

---

## 13. Next steps

1. SECURITY DEFINER RPC for worker accept/decline of offers.  
2. Device E2E: offer → accept → confirmed shift visible.  
3. Product decision: keep immediate confirm RPC for crew tools or deprecate.  
4. Sweep remaining escrow theater strings.

---

## 14. Release assessment

# **NO-GO** (full marketplace launch)

Green compile + SQL + admin E2E and fixed offer integrity are necessary but not sufficient. Worker/organizer device journeys and live OTP remain unverified.

**GO WITH DOCUMENTED LIMITATIONS** only if stakeholders explicitly ship admin+API with written exclusions for mobile/OTP/push/bank rails.

Never claim zero bugs or production readiness from available tests alone.
