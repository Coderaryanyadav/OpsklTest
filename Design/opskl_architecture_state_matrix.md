# Opskl — Information Architecture & Screen Inventory (Phase 0 Foundation)

## 1. Visual Direction & Design Rationale
- **Foundation**: Monochromatic discipline (black `#0F172A`, slate neutrals `#F8FAFC`, `#E2E8F0`, `#64748B`, `#1E293B`) paired with high-intent Precision Blue (`#2563EB`) as the single semantic action accent.
- **Why this improves Trust & Clarity in Mumbai**:
  - Eliminates visual noise and decorative gimmicks so shift timings (IST), clear wage basis (₹/hour vs ₹/shift), and strict legal verification states stand out immediately in noisy, high-pressure event environments (NESCO, BKC, South Mumbai venues).
  - Explicit non-color status badges (e.g. `[Icon + "Applied - Pending Review"]`, `[Icon + "Selected - Awaiting Confirmation"]`, `[Icon + "Confirmed - Active"]`) prevent misunderstanding of hiring or payout status.

---

## 2. Information Architecture by Role

### A. Worker Mobile Experience
1. **Onboarding & Identity**: Welcome Value Prop → Phone/OTP Authentication (with cooldown & retry) → Profile Setup (Skills, Locality/Mumbai Zones) → KYC Verification Submission (Aadhaar/PAN masked upload) → KYC Under Review & Status States.
2. **Discover & Application**: Discover Feed (Mumbai event clusters: BKC, Goregaon/NESCO, Lower Parel) → Filter/Search (Wage basis ₹/hr vs ₹/shift, Role, Date) → Shift Details (Venue, Reporting time, Dress code, Verified organizers only) → Application Review & Submit → Application Received Status (Truthful: "Application Submitted", NOT "Hired").
3. **Shift Execution & Attendance**: My Shifts (Upcoming, Needs Action, In Progress, Completed) → Confirmed Shift Detail with Venue Nav & Briefing → Check-in Screen (Geofence validation + OTP/QR check-in token) → Shift Active Timer → Check-out Flow → Attendance Submitted for Approval.
4. **Earnings & Account**: Earnings Ledger (Separating: Projected, Under Review, Approved for Payout, Disbursed to Bank/UPI) → Notifications → Help & Emergency Safety Support → Settings/Profile & Account Deletion.

### B. Organizer Mobile Experience
1. **Registration & Business Verification**: Business Registration → GSTIN / Entity Document Upload → Verification Status (Unverified cannot publish shifts).
2. **Shift Creation & Management**: Multi-step Shift Creator (Headcount, Role, Exact venue in Mumbai, Clear wage basis ₹, Reporting instructions) → Shift Review & Publish.
3. **Crew Roster & Selection**: Applicant Queue → Privacy-safe Candidate Review → Select Candidate (Triggers "Awaiting Confirmation", not confirmed) → Confirmed Crew Roster with Live Status.
4. **Event-day Attendance Console**: Live Crew Check-in Roster (Present, Late, Absent, Dispute) → Attendance Approval & Hours Adjustment.
5. **Finance & Invoicing**: Wage obligation + 10% platform fee + 18% GST itemized breakdown → Settlement Tracking.

### C. Admin Web Console
1. **Verification Queues**: Worker KYC Queue (masked Aadhaar/PAN inspection, approve/reject with preset reasons) & Organizer Business Document Queue.
2. **Shift Moderation**: Review posted shifts against fair wage guidelines and venue safety standards.
3. **Disputes & Safety**: Shift dispute resolution & Incident escalation panel.
4. **Marketplace Controls**: Audit log, pause marketplace controls with dual confirmation.

---

## 3. Truthful State Matrix (Non-Negotiable Business Rules)
- `Applied` ≠ `Selected` (Worker must be shortlisted, then chosen).
- `Selected` ≠ `Confirmed` (Worker must explicitly review and accept before roster lock).
- `Checked-In` ≠ `Completed` (Requires completed shift hours and check-out).
- `Attendance Approved` ≠ `Paid` (Approval validates hours; payout initiation is a separate financial step).
- `Masked Identifiers`: Aadhaar and PAN documents are never shown unmasked; full government ID details are strictly shielded from public and organizer views.
