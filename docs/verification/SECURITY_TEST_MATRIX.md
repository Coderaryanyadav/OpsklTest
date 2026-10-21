# SECURITY_TEST_MATRIX

**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Constraint:** Non-production only; no destructive prod actions; secrets not printed.

| Test ID | Actor | Resource | Attempted action | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | anonymous | Admin `/` | open dashboard | redirect login | **NOT RUN** (no browser session) | **NOT RUN** | middleware SRC requires auth |
| SEC-02 | authenticated non-admin | Admin `/` | open dashboard | `unauthorized_role` redirect | **NOT RUN** | **NOT RUN** | middleware checks `profiles.role === 'admin' && is_active` |
| SEC-03 | worker | `confirm_worker_booking_safe` | confirm as worker | deny | **NOT RUN** live | **BLOCKED** | RPC fail-closed pattern SRC |
| SEC-04 | organizer A | job of organizer B | edit/cancel | deny | **NOT RUN** | **BLOCKED** | RLS+RPC intended |
| SEC-05 | worker | other worker verification storage | signed URL | deny | **NOT RUN** | **BLOCKED** | — |
| SEC-06 | client | self-set `verification_status=verified` | direct update | deny / trigger | UNIT related tests PASS mocked | **PARTIAL** | security_* unit suites |
| SEC-07 | anyone | escalate to admin role | profile update | blocked by guard | SQL-STATIC PASS (migration text) | **PARTIAL** | test-sql 2.10; live **BLOCKED** |
| SEC-08 | client | check-in with wrong code | forge attendance | reject | UNIT PASS mocked | **PARTIAL** | booking_attendance.test |
| SEC-09 | client | payment webhook without secret | credit payout | reject fail-closed | SRC | **NOT RUN** | payments.ts |
| SEC-10 | repo | secrets in git | commit `.env` | ignored | `.env` present on disk; git status clean (not modified) | **NEEDS HUMAN REVIEW** | ensure `.gitignore` covers; do not commit |
| SEC-11 | mobile bundle | `EXPO_PUBLIC_*` | embed anon key | expected for Supabase | anon key is public by design; service role must not be EXPO_PUBLIC | **PASS** (example layout) | `.env.example` |
| SEC-12 | service role | shell env | present in CI agent | unset in verifier shell | unset | **PASS** (this shell) | BASELINE |
| SEC-13 | abuse | OTP flood | resend spam | rate limit | helpers exist SRC; live **NOT RUN** | **PARTIAL** | auth.ts cooldown |
| SEC-14 | PII logs | logger | log gstin/aadhaar | redacted | UNIT PASS | **PASS** (unit) | phase2_shared_ui.test |
| SEC-15 | escrow label | UI | imply bank hold | must not claim live VAN | honesty copy present many screens | **PARTIAL** | product risk if marketing elsewhere |
| SEC-16 | Playwright admin | E2E auth bypass | — | — | **NOT RUN** | **NOT RUN** | — |

## Findings summary

| Severity | Finding | Status |
| --- | --- | --- |
| P0 potential | Live RLS/authz effectiveness unproven this session | **BLOCKED** verification |
| P1 | Admin/mobile E2E auth paths not executed | **NOT RUN** |
| P2 | Device evidence URIs for incidents may not upload to secured storage | **NEEDS HUMAN REVIEW** |
| Hygiene | Local `.env*` files on disk | **NEEDS HUMAN REVIEW** / ensure ignore |

**No security control was weakened for this audit.** No live privilege-escalation probe completed successfully or failed—connectivity blocked.
