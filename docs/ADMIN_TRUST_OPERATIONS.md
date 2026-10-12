# Opskl Admin & Trust Operations Console (Phase 8)

## 1. Executive Summary

Phase 8 introduces the secure Next.js administration and operations dashboard for the Opskl Trust, Operations, and Legal teams. The console enforces strict server-side role-based access control (`admin` role), private document inspection, attendance dispute adjudication, and immutable audit logging.

---

## 2. Console Modules

Located at [apps/admin/src/app/page.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/admin/src/app/page.tsx):

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── page.tsx          # 12-Module Trust & Operations Console
│   │   ├── login/page.tsx    # Secure Admin Session Authentication
│   │   ├── layout.tsx        # Base Root Layout
│   │   └── globals.css       # Obsidian & Teal Design Tokens
│   └── ...
```

### Module Breakdown

| Module ID | Module Title | Primary Capabilities & Governance |
| :--- | :--- | :--- |
| **`overview`** | **Platform Overview & Escrow Operations** | 8 real-time KPI metrics: Active Shifts, Escrow Held (INR), Verified Workers, Active Organizers, Fee Revenue, Pending Verifications, Open Disputes, Safety Incidents. |
| **`verifications`** | **Verification Queue** | Review Aadhaar, PAN, and GSTIN documents. Masked identification numbers (`XXXX-XXXX-4910`) protect raw identity data. Approves badge or rejects with mandatory reason. |
| **`disputes`** | **Attendance Disputes** | Adjudicates contested shift duty hours, supervisor sign-offs, and GPS proximity context. Adjusts net payout and releases escrow or issues refunds. |
| **`safety`** | **Trust & Safety Incidents** | Immediate escalation for critical safety issues (e.g. unsafe scaffolding, harassment). Enacts account bans, formal warnings, or site inspector dispatch. |
| **`jobs`** | **Shift Moderation** | Enforces minimum living wage floor (≥₹100/hr living wage), duties review, and pause/cancel actions with documented reason. |
| **`workers`** | **Worker Management** | Profile verification status, completed shifts, attendance reliability scores, and account status controls. |
| **`organizers`** | **Organizer Businesses** | Verified GSTIN status, total shift spending, crew retention rates, and account status controls. |
| **`bookings`** | **Bookings Roster** | Complete state machine inspection (`applied` $\rightarrow$ `completed`), check-in code auditing, and administrative status overrides. |
| **`payments`** | **Payment Reconciliation** | Escrow deposit monitoring, NPCI 12-digit UTR matching, failed payout retry triggers, and manual reconciliation logs. |
| **`reviews`** | **Reviews & Abuse Reports** | Moderation of ratings and feedback; removal of retaliatory or fraudulent reviews with documented justification. |
| **`audit`** | **Audit Trail Logs** | Chronological immutable table of every consequential administrative decision with actor email, action type, and JSON changes diff. |
| **`settings`** | **System Configuration** | Living wage floor (₹100/hr), marketplace fee (10%), GST rate (18%), sandbox/live toggle, and TRAI DLT header (`OPSKIL`). |

---

## 3. Verification & Identity Governance

- **Private Document Handling**: Raw identity documents (Aadhaar cards, PAN cards, GSTIN certificates) are stored in restricted encrypted storage (`secure-vault/`). Reviewers inspect only masked representations (`XXXX-XXXX-4910`, `ABCDE****F`).
- **Authentic Badging**: The verification badge corresponds strictly to a completed document match against official databases. The app explicitly never implies an in-person criminal background check has been conducted when it has not.
- **Mandatory Rejection Reason**: Stored procedure [`admin_verify_case_safe`](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000006_admin_and_trust_operations.sql#L125-L188) rejects cases only when a compliance reason is recorded (e.g., *“Name mismatch between PAN and bank account”*).

---

## 4. Attendance & Wage Disputes Adjudication

- **Investigation Workflow**: When an attendance dispute is filed:
  1. Staff inspects worker claimed departure time vs. supervisor sign-off time.
  2. Staff examines venue check-in code entry timestamp and GPS proximity distance calculation.
  3. Staff inputs findings into case notes and specifies adjusted net payout.
  4. Stored procedure [`admin_resolve_dispute_safe`](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000006_admin_and_trust_operations.sql#L65-L123) locks the row, updates the dispute status, adjusts the payout record, and releases the escrow balance.

---

## 5. Trust & Safety Incident Escalation

- **Severity Levels**: `low`, `medium`, `high`, `critical`.
- **Urgent Actions**: Critical safety reports (e.g., missing safety harnesses on construction staging) trigger account suspension and automated standby cancellation.
- **Decision Trail**: The stored procedure [`admin_resolve_safety_report_safe`](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000006_admin_and_trust_operations.sql#L236-L282) mandates a documented action taken before closing any incident ticket.

---

## 6. Security & Server RBAC

- **Role Verification**: Admin stored procedures execute with `SECURITY DEFINER` and verify that `profiles.role = 'admin'` for `auth.uid()`. Non-admin users are rejected with `403 Unauthorized`.
- **Immutable Audit Logging**: Every administrative action automatically creates a row in `audit_logs` capturing:
  ```json
  {
    "actor_id": "uuid",
    "action": "admin_resolve_dispute",
    "entity_type": "disputes",
    "entity_id": "uuid",
    "changes": {
      "status": "resolved",
      "adjusted_payout": 1850,
      "resolution_notes": "Verified 2 hours overtime via supervisor logs"
    }
  }
  ```
