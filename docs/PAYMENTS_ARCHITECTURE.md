# Opskl Payments, Earnings & Financial Architecture (Phase 6)

## 1. Executive Summary & Regulatory Safeguards

Opskl operates as a compliant two-sided marketplace connecting event organizers with short-duration shift workers in India. Financial operations strictly adhere to:
1. **Sacrosanct Worker Wages**: 100% of the agreed daily wage is disbursed to the worker. Opskl charges **0% commission** from worker pay.
2. **Transparent Organizer Billing**: Organizers are billed:
   $$\text{Total Invoice} = \text{Gross Worker Wages} + \text{Opskl Platform Fee (10\%)} + \text{GST (18\% on fee)}$$
3. **Indian GST Act Compliance**: Under the CGST/IGST Act, intermediary marketplace fees are categorized under SAC Code `998519` (Support services). GST (18%) is applied **strictly to the platform fee**, NOT to pass-through worker wages. Full B2B Tax Invoices with GSTIN are generated for Input Tax Credit (ITC).
4. **RBI Nodal / Escrow Rules**: Opskl does not operate an unregulated closed-loop wallet. Organizer deposits are secured in partner bank escrow nodal accounts (e.g. Razorpay Route / Cashfree Escrow) until verified attendance sign-off.
5. **No Client-Side Money Claims**: Mobile apps NEVER declare a payment successful or alter authoritative monetary amounts. All state transitions occur through cryptographically signed server webhooks or idempotent database stored procedures (`process_payment_webhook_safe`).

---

## 2. Worker Earnings Architecture

The Worker mobile app ([apps/worker/app/(tabs)/earnings.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/worker/app/(tabs)/earnings.tsx)) surfaces all 6 required financial dimensions:

| Dimension | Definition | Source State |
| :--- | :--- | :--- |
| **Confirmed Upcoming Wages** | Shifts booked and accepted on the calendar | `bookings.status = 'confirmed'` |
| **Awaiting Sign-off** | Shift completed; organizer attendance verification pending | `bookings.status IN ('checked_out', 'completed_awaiting_review')` |
| **Approved in Transit** | Attendance approved; escrow release queued | `payment_records.status IN ('escrow_locked', 'processing')` |
| **Paid Earnings** | Settled directly into worker's bank via IMPS/UPI | `payment_records.status = 'settled'` with 12-digit UTR |
| **Failed / Delayed** | Bank network timeout or invalid UPI handle | `payment_records.status = 'failed'` with retry CTA |
| **Disputed Amounts** | Wage disputes under platform arbitration | `bookings.status = 'disputed'` |

Workers can review transaction receipts containing the bank UTR, settlement timestamp, hours worked, and update their default receiving UPI handle (`username@bank`).

---

## 3. Organizer Finances & Invoicing

The Organizer console ([apps/organizer/app/(tabs)/finances.tsx](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/apps/organizer/app/(tabs)/finances.tsx)) provides:
- **Total Staffing Spend**: Segregated into Worker Wages, Opskl Platform Fee, and 18% GST.
- **Settled vs. Outstanding Escrow**: Real-time balance of funded vs. pending shift escrows.
- **Tax Invoice & Statements**: Itemized PDF/in-app statement with invoice number (`INV-202610-XXXX`), GST breakdown, and payment due date.
- **Audit Reconciliation Log**: Tracks every inbound order capture, payout settlement, and dispute hold.

---

## 4. Payment Provider Abstraction

Located in [packages/shared/src/payments/](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/packages/shared/src/payments/):

```
packages/shared/src/payments/
├── provider.interface.ts   # PaymentProvider interface & DTOs
├── calculator.ts           # Authoritative server-side math & UPI validator
├── crypto-utils.ts         # HMAC SHA-256 signature generation/verification
├── sandbox-provider.ts     # Complete mock provider with failure injection
├── razorpay-provider.ts    # Production adapter for Razorpay Route & RazorpayX
└── index.ts
```

### Supported Gateway Methods
- **Razorpay Route**: Automated split payment holding funds in escrow and routing wages to worker virtual accounts.
- **RazorpayX / Cashfree Payouts**: Direct-to-bank UPI (Virtual Payment Address) disbursement using NPCI 24x7 IMPS rails.
- **Sandbox Provider**: Deterministic testing simulator generating realistic 12-digit numeric Indian UTR references (`42XXXXXXXXXX`), simulating NPCI bank downtimes, and verifying HMAC webhook signatures.

---

## 5. Idempotent Webhook Engine & Database Architecture

Database migration: [supabase/migrations/20261012000004_payments_and_earnings.sql](file:///Users/aryan/Desktop/PROJECTS/OPSKIL/supabase/migrations/20261012000004_payments_and_earnings.sql).

### Idempotency Safeguards
1. **Unique Event Key**: Every provider event ID (`event_id`, e.g. `evt_sbx_12345`) is stored in `payment_webhook_events`. Duplicate deliveries are flagged (`duplicate: true`) and discarded without side-effects.
2. **Row Locking**: Financial calculations and invoice generation lock rows using `FOR UPDATE`.
3. **Reconciliation Audit Trail**: Every webhook write logs an immutable entry to `payment_reconciliation_logs` recording expected vs. recorded amounts and discrepancy reasons.

---

## 6. Live Deployment Checklist

To transition from Sandbox mode to Live Production:
1. Complete Razorpay / Cashfree Merchant Onboarding with Indian Business PAN and GSTIN (`27AABCO...`).
2. Configure environment variables in `.env`:
   ```bash
   RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXX
   RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX
   RAZORPAY_WEBHOOK_SECRET=XXXXXXXXXXXXXXXXXXXX
   RAZORPAYX_ACCOUNT_NUMBER=787878XXXXXXXX
   PAYMENT_PROVIDER_MODE=live
   ```
3. Set Webhook URL in payment provider dashboard:
   `https://<your-supabase-project>.functions.supabase.co/payment-webhook`
   Subscribed events:
   - `order.paid`
   - `payment.captured`
   - `payout.processed`
   - `payout.failed`
   - `payout.reversed`
