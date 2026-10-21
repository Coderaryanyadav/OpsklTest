# DEFECT_LOG — Engineering Repair

| ID | Sev | Reproduction | Expected | Actual (before) | Root cause | Fix | Regression | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ENG-001 | P1 | Organizer screening → Send Offer | Booking `selected_awaiting_confirmation` | Called confirm RPC → `confirmed` | Wrong RPC for offer UX | `select_worker_offer_safe` + `selectWorkerOfferSafe` | Jest 1b + typecheck | **FIXED** |
| ENG-002 | P1 | Persist application offer status | Enum accepts awaiting | Enum missing value | Schema drift vs types | `ALTER TYPE ... ADD VALUE` | Live enum query | **FIXED** |
| ENG-003 | P2 | Revoke offer | Cancel booking by booking id | Passed application id / org-1 | Wrong id + fake fallback | bookingId map + auth required | code review | **FIXED** |
| ENG-004 | P2 | Send offer without shift | Fail closed | Used `job-bkc-vip-01` | Placeholder id | Require `shift.id` | code | **FIXED** |
| ENG-005 | P2 | Open Finances with empty/live jobs | Live calculator or empty | Hardcoded ₹16,099 / ESC ref | Demo UI residual | `calculateJobFinancials` | unit already covers calc | **FIXED** |
| ENG-006 | P2 | Admin Shifts table | Honest ledger label | ESCROW / Fully Funded | Misleading copy | LEDGER / Estimate | Playwright 5/5 | **FIXED** |
| ENG-007 | P2 | Open dispute detail | No fake telemetry | Hardcoded BLE timeline | Demo UI residual | Honest not-wired notice | Playwright disputes | **FIXED** |
| ENG-008 | P3 | Offline incident queue message | No BLE claim | BLE mesh wording | Stale copy | Network-only sync copy | cross_product tests | **FIXED** |
| ENG-009 | P3 | Worker onboarding UPI step | No instant payout claim | INSTANT UPI ENABLED | Theater badge | UPI ON FILE | worker unit test | **FIXED** |
