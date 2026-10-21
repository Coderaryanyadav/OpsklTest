# WORKFLOW_TEST_MATRIX

**Commit:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
Statuses: PASS | FAIL | BLOCKED | NOT RUN | PARTIAL | NEEDS HUMAN REVIEW

| Test ID | Phase | Feature / workflow | Preconditions | Steps / command | Expected | Actual | Status | Evidence | Mocked? | Defect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-00-TC | 0 | Typecheck all workspaces | clean tree | `npm run typecheck` | exit 0 | exit 0 | **PASS** | `evidence/typecheck.txt` | N/A | — |
| WF-00-LINT | 0 | Lint | clean tree | `npm run lint` | exit 0 | exit 0 | **PASS** | `evidence/lint.txt` | N/A | — |
| WF-00-UNIT | 0 | Unit/integration Jest | node_modules | `npm test` | exit 0 | exit 0; 329 tests aggregated | **PASS** | `evidence/unit-tests.txt` | **Yes** (Supabase mocked) | — |
| WF-00-ADMIN-BUILD | 0 | Admin Next build | — | `npm run build:admin` | exit 0 | exit 0 | **PASS** | `evidence/build-admin.txt` | Build | — |
| WF-00-SQL-STATIC | 0 | Migration invariants | migrations present | `npm run test:sql` | static checks pass | 26/26 pass | **PASS** | `evidence/test-sql.txt` | Static text | — |
| WF-00-SQL-LIVE | 0 | Live DB connect | network + credentials | same script live phase | connect OK | ENOTFOUND pooler host | **BLOCKED** | `evidence/test-sql.txt` EXIT 1 | Live attempted | D-ENV-001 |
| WF-00-PW-LIST | 0 | Playwright inventory | admin package | `npx playwright test --list` | lists tests | 5 tests listed | **PASS** (inventory only) | `evidence/playwright-list.txt` | N/A | — |
| WF-00-PW-RUN | 0 | Playwright E2E | admin + browser + auth | `npm run test:e2e:admin` | scenarios pass | **not executed** | **NOT RUN** | — | — | D-ENV-002 |
| WF-00-MAESTRO | 0 | Maestro mobile | device/sim | maestro test `.maestro/*` | flows pass | **not executed** | **NOT RUN** | — | — | D-ENV-002 |
| WF-01-STITCH-MAP | 1 | All 28 screens mapped | Design/ | folder+route inventory | every folder mapped | 28 mapped in inventory | **PASS** (mapping) | SCREEN_AND_ROUTE_INVENTORY.md | SRC | — |
| WF-01-VISUAL | 1 | Pixel / control parity | device | compare PNG vs runtime | pixel OK | no runtime screenshots this session | **NOT RUN** | — | — | — |
| WF-01-OPTIONS | 1 | Every selection option | UI | exercise all options | each option works | not exercised | **NOT RUN** | — | — | D-TEST-001 |
| WF-03-OTP-OK | 3 | Phone OTP success | test phone | sign-in flow | session created | not run live | **NOT RUN** | — | Live | D-ENV-003 |
| WF-03-OTP-FAIL | 3 | OTP wrong/expired | test phone | bad token | rejected | not run | **NOT RUN** | — | — | — |
| WF-03-KYC-SUBMIT | 3 | KYC upload | worker session | upload doc | case pending | not run live | **NOT RUN** | — | — | — |
| WF-03-KYC-SPOOF | 3 | Client spoof verified | crafted request | cannot self-verify | server rejects | not run live | **NOT RUN** | UNIT has related auth tests | Mock | — |
| WF-04-DISCOVER | 4 | Feed loads jobs | worker+DB | open discover | cards from DB | not run live | **BLOCKED** | — | Live | D-ENV-001 |
| WF-04-APPLY | 4 | Apply once | eligible worker | swipe/apply | application row | not run live | **BLOCKED** | UNIT mocks apply | Mock PASS ≠ live | — |
| WF-04-DUP | 4 | Duplicate apply | existing app | apply again | rejected | not run live | **NOT RUN** | — | — | — |
| WF-05-CHECKIN | 5 | Check-in with code+geo | confirmed booking | GeofencedCheckInModal | checked_in | not run live | **BLOCKED** | UNIT booking_attendance mocked | Mock | — |
| WF-05-CHECKIN-BAD | 5 | Wrong code | booking | bad code | fail closed | UNIT PASS (mocked) | **PARTIAL** | unit-tests | Mock | — |
| WF-05-EARNINGS | 5 | Earnings states | worker payments | open earnings | ledger matches DB | not run live | **NOT RUN** | — | — | — |
| WF-06-CREATE | 6 | Create/publish shift | verified org | create wizard | job open | not run live | **BLOCKED** | — | — | — |
| WF-06-VALIDATION | 6 | Invalid/time/wage validation | form | invalid combos | blocked | UNIT/SQL-STATIC partial | **PARTIAL** | test-sql + unit | Mixed | — |
| WF-07-SCREEN | 7 | Screening select/confirm | applicants | select worker | selected≠confirmed until accept | source wired; live **NOT RUN** | **PARTIAL** | SRC | — | — |
| WF-07-ATTEND | 7 | Attendance sign-off | on_duty bookings | approve hours | attendance≠paid | source wired; live **NOT RUN** | **PARTIAL** | SRC | — | — |
| WF-07-ESCROW-CLAIM | 7 | Escrow fund movement | — | bank hold | funds held | **no live rail** | **FAIL product claim if marketed as live** | honesty copy present | N/A | D-PROD-001 (documentation risk) |
| WF-08-ADMIN-AUTH | 8 | Non-admin blocked | non-admin cookie | hit `/` | redirect unauthorized | middleware SRC; live **NOT RUN** | **PARTIAL** | middleware.ts | — | — |
| WF-08-QUEUES | 8 | Admin queues load | admin session | open modules | live rows | not run | **NOT RUN** | — | — | — |
| WF-09-NOTIF | 9 | Push delivery | tokens | send notification | delivered | **BLOCKED** | — | — | D-ENV-004 |
| WF-09-OFFLINE | 9 | Offline queue sync | offline | enqueue+sync | pending→synced | UNIT partial; device **NOT RUN** | **PARTIAL** | — | — | — |
| WF-09-KILL | 9 | Killswitch blocks apply | pause on | apply | rejected server-side | UNIT may cover; live **NOT RUN** | **PARTIAL** | — | — | — |
| WF-10-E2E-A | 10 | Onboard→KYC→apply→confirm | multi accounts | full path | consistent states | **NOT RUN** | **NOT RUN** | — | — | D-ENV-002 |
| WF-10-E2E-B | 10 | Create→screen→crew | multi accounts | full path | roster matches | **NOT RUN** | **NOT RUN** | — | — | — |
| WF-10-E2E-C | 10 | Attendance→earnings | multi accounts | full path | ledger consistent | **NOT RUN** | **NOT RUN** | — | — | — |
| WF-10-E2E-D | 10 | Incident→admin | multi accounts | full path | audit row | **NOT RUN** | **NOT RUN** | — | — | — |
| WF-CALC-FEE | 7/10 | Fee/GST calculator | pure fn | `calculateJobFinancials(10,1500,10,18)` | wages 15000, fee 1500, GST 270, total 16770 | Independent recompute matches UNIT | **PASS** | calculator.ts + payments_and_earnings.test | Unit | — |

## Summary

| Status | Count |
| --- | --- |
| PASS | 7 (incl. compile/lint/unit/build/sql-static/map/calc) |
| PARTIAL | 10+ |
| BLOCKED | 5+ |
| NOT RUN | majority of critical multi-app workflows |
| FAIL | 0 runtime FAIL this session (product escrow marketing risk logged as defect) |
