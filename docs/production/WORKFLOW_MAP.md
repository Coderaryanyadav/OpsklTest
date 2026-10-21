# WORKFLOW MAP

## Critical journeys

| ID | Journey | Path | Verified how | Status |
| --- | --- | --- | --- | --- |
| W1 | Worker onboarding → apply → organizer offer → worker accept → confirmed | shared RPCs + UI | Unit/SQL/RPC; **device NOT RUN** | PARTIAL |
| W2 | Organizer create → publish → applicants → offer | `create_job_safe`, screening | SQL live + unit | PARTIAL |
| W3 | Confirmed → check-in → earnings state | check-in RPC, earnings UI | Unit; device NOT RUN; no bank settle | PARTIAL |
| W4 | KYC submit → admin resolve | storage + admin queue | Unit/build/Playwright nav; live decision NOT RUN | PARTIAL |
| W5 | Incident → admin safety | insert + admin | Unit; live NOT RUN | PARTIAL |
| W6 | Finance calc → invoice | `calculateJobFinancials`, `generate_job_invoice_safe` | Unit + SQL invariants | PARTIAL |
| W7 | Session expiry | middleware + mobile auth | SRC; Playwright login; expiry NOT RUN | PARTIAL |

## State machine (bookings)

`selected_awaiting_confirmation` → (worker accept) `confirmed` → `checked_in` → `checked_out` → `completed*`  
Organizer **offer** uses `select_worker_offer_safe` (holds capacity).  
Organizer **immediate confirm** still available via `confirm_worker_booking_safe` (product decision: keep for crew tools).  
Worker accept/decline: `worker_confirm_selection_safe` / `worker_decline_selection_safe`.

## Truth rules (enforced in copy + code where fixed)

- Applied ≠ hired/confirmed  
- Attendance approval ≠ paid bank settlement  
- Offline queued ≠ server accepted  
- No BLE mesh / no live VAN escrow / no UIDAI OCR theater
