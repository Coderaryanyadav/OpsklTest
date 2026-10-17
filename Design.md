# OPSKL — COMPLETE MOBILE APP UI/UX DESIGN SYSTEM
## Worker App + Organizer App | Production-Grade Design Specification

### YOUR ROLE

Act as a world-class Apple-level product designer, senior mobile UX architect, design systems engineer, accessibility specialist, and marketplace product strategist.

Design the entire Opskl mobile product from the perspective of a first-time user who has never heard of the platform.

Opskl is a real-world event staffing marketplace connecting:
- Workers seeking legitimate short-duration, event-based paid work.
- Event organizers and agencies that need reliable staff for individual shifts.

Create TWO distinct but visually consistent mobile applications:

1. **Opskl Worker** — discover jobs, apply for shifts, manage bookings, verify identity, check in, track earnings, and manage a worker profile.
2. **Opskl Organizer** — create and publish shifts, review applicants, manage confirmed workers, coordinate attendance, manage invoices, and monitor business activity.

The final result must look like a premium, professionally funded technology product, not a college project, template marketplace, or generic dashboard.

---

# 1. NON-NEGOTIABLE VISUAL DIRECTION

### Color system

Use a strictly monochrome design system.

- Primary black: #000000
- Primary white: #FFFFFF
- Secondary background: #F5F5F5
- Subtle surface: #FAFAFA
- Primary text: #111111
- Secondary text: #737373
- Dividers: #E5E5E5
- Disabled controls: #D4D4D4
- Inverse text: #FFFFFF on black

Do not introduce blue, purple, emerald, teal, orange, or other decorative accent colors.

Use semantic colors for important error, warning, success, and safety states only when required for accessibility or clear communication. Keep them restrained and consistent.

### Design philosophy

Use Apple-quality visual discipline:
- Clear visual hierarchy.
- Confident, editorial typography.
- Generous but purposeful whitespace.
- Strong alignment and consistent spacing.
- Beautifully designed forms and lists.
- Minimal borders and subtle separators.
- Restrained shadows.
- Large readable headings.
- Precise icon sizing.
- Consistent corner radii.
- Native-feeling interactions.
- Premium motion and transitions.
- No unnecessary gradients.
- No glassmorphism overload.
- No decorative elements that do not serve a purpose.

Do not make every screen a floating card. Use typography, alignment, dividers, full-width layouts, and negative space intelligently.

### Typography

Use a modern, highly legible sans-serif typeface such as Inter or a suitable system font.

Establish consistent typography tokens:
- Large page heading: 30–36 px.
- Screen heading: 24–30 px.
- Section heading: 18–22 px.
- Body text: 14–16 px.
- Supporting text: 12–14 px.
- Small labels: 11–12 px.
- Buttons: 15–16 px, medium or semibold.

These are design targets, not rigid rules. Adapt appropriately to the device and content.

### Layout

Design primarily for modern iPhone and Android phone screens, with adaptable layouts for smaller devices and larger screens.

- Use safe areas around notches and system navigation.
- Support dynamic text sizing.
- Keep primary actions reachable.
- Make touch targets approximately 44–48 px or larger.
- Never clip page titles or tab labels.
- Use scrollable content instead of squeezing everything onto one screen.
- Keep bottom navigation stable and visually consistent.
- Avoid overlapping keyboards, buttons, banners, and bottom sheets.
- Support both light and dark system appearance using the same monochrome design principles.

---

# 2. BRAND AND COMPONENT SYSTEM

Create a complete reusable Opskl design system before producing the screens.

Design:
- Wordmark and simple app icon.
- Primary and secondary buttons.
- Destructive and disabled buttons.
- Text fields and password fields.
- Phone-number and OTP inputs.
- Search bars.
- Date and time selectors.
- Location selectors.
- Wage and number inputs.
- Dropdowns and selection lists.
- Radio buttons and checkboxes.
- Toggle switches.
- Segmented controls.
- Bottom sheets.
- Dialogs and confirmation modals.
- Navigation bars.
- Bottom navigation.
- Top navigation.
- Status chips.
- Progress indicators.
- Loading skeletons.
- Empty states.
- Error states.
- Success states.
- Offline banners.
- Upload progress.
- Document previews.
- Profile avatars.
- Worker identity cards.
- Shift cards.
- Applicant rows.
- Attendance indicators.
- Invoice rows.
- Search and filter controls.
- Toast notifications.
- Permission request screens.

Every component must use consistent spacing, typography, contrast, shape, and interaction behavior.

Do not invent multiple visual styles for the same component.

---

# 3. WORKER APP — COMPLETE SCREEN INVENTORY

Create a separate, clearly labeled Worker App section containing all the following screens.

## A. First launch and authentication

W01. Splash screen with Opskl wordmark.

W02. Welcome screen explaining how workers find legitimate event shifts.

W03. Role selection: Worker or Organizer.

W04. Worker sign-up using phone number or email.

W05. Phone-number entry with country code.

W06. OTP verification with resend countdown, edit-number option, and error handling.

W07. Email verification and verification-pending state.

W08. Login screen.

W09. Forgot-password screen, if password authentication is supported.

W10. Password reset confirmation.

W11. Existing-account detection and account recovery.

W12. Terms of service, privacy policy, and consent screen.

W13. Authentication loading state.

W14. Session-expired screen with safe reauthentication.

W15. Login failure, network failure, and retry states.

Do not design authentication options as functional integrations unless the underlying application supports them.

## B. Worker profile setup

W16. Profile completion introduction.

W17. Personal details form.

W18. Profile photo upload and cropping.

W19. Skills selection.

W20. Work experience and previous event experience.

W21. Preferred work categories.

W22. Preferred work locations.

W23. Availability calendar.

W24. Language selection.

W25. Emergency contact form.

W26. Bank or payout details, only if required by the actual payout workflow.

W27. Profile review before submission.

W28. Profile completion success.

W29. Incomplete-profile reminder.

W30. Edit profile screen.

## C. Identity verification and KYC

W31. KYC introduction explaining why verification is required.

W32. Identity document selection.

W33. Aadhaar verification/document flow, using a lawful, consent-based verification process.

W34. PAN verification/document flow.

W35. Document capture or upload.

W36. Document preview and confirmation.

W37. Selfie or liveness verification, only if supported by the verification provider.

W38. Secure document upload progress.

W39. KYC submitted confirmation.

W40. Verification pending screen.

W41. Verification approved screen.

W42. Verification rejected screen with the actual rejection reason.

W43. Resubmit-document flow.

W44. Expired-document or re-verification screen.

W45. KYC technical failure and retry.

Clearly distinguish pending, approved, rejected, expired, and failed states.

Do not expose identity-document numbers or sensitive details unnecessarily.

## D. Discover shifts

W46. Main Discover screen with location selector and search.

W47. Nearby shift feed.

W48. Full-screen swipe-to-discover experience.

W49. Compact list-view alternative.

W50. Shift detail screen.

W51. Event organizer information.

W52. Venue details and map preview.

W53. Wage breakdown and working hours.

W54. Date, reporting time, dress code, skills, and responsibilities.

W55. Save/bookmark shift.

W56. Search results.

W57. Filter bottom sheet for date, locality, hourly wage, job type, and category.

W58. Sort options.

W59. Map and location-permission explanation.

W60. Location permission denied state with manual location selection.

W61. No nearby shifts empty state.

W62. No results after filtering.

W63. Loading skeleton for the discovery feed.

W64. Discovery network-error state.

W65. Closed, cancelled, expired, or filled shift state.

Make the swipe interface feel effortless. Display the hourly wage prominently, followed by date, duration, location, event type, and key requirements.

Do not use fake workers, fake jobs, fake ratings, or invented organizer details.

## E. Applications and shift decisions

W66. Apply confirmation sheet.

W67. Application submission progress.

W68. Application submitted confirmation.

W69. Application status: pending review.

W70. Application accepted/booking confirmation.

W71. Application declined.

W72. Application withdrawn, if withdrawal is supported.

W73. Application history.

W74. Duplicate application prevention.

W75. KYC-required blocking state.

W76. Profile-completion-required blocking state.

W77. Shift no longer available state.

W78. Application request failed with retry.

W79. Organizer requests additional information, if supported.

W80. Booking details screen.

Never show an application as successful before the server confirms it.

## F. My Shifts and scheduling

W81. My Shifts overview.

W82. Upcoming confirmed shifts.

W83. Pending applications.

W84. Completed shifts.

W85. Cancelled shifts.

W86. Shift detail with reporting instructions.

W87. Add-to-calendar action.

W88. Shift reminder settings.

W89. Google Maps navigation handoff.

W90. Reporting instructions and venue contact details.

W91. Shift rescheduled notification and updated details.

W92. Shift cancelled notification and resolution.

W93. Worker cancellation request, if supported.

W94. Empty My Shifts state.

W95. Schedule conflict warning.

## G. Attendance and on-site experience

W96. Pre-shift checklist.

W97. Confirmed shift identity screen.

W98. Location permission explanation for check-in.

W99. GPS verification in progress.

W100. Outside permitted geofence state.

W101. Location accuracy insufficient state.

W102. Eligible-to-check-in screen.

W103. Worker selfie verification before QR generation, if this workflow is supported.

W104. Secure, time-limited worker QR/code screen.

W105. QR/code expiry countdown.

W106. Expired QR/code regeneration.

W107. Organizer scan confirmation.

W108. Successful check-in.

W109. Check-in failure and retry.

W110. Active shift screen.

W111. Check-out screen.

W112. Successful check-out.

W113. Attendance history.

W114. Attendance discrepancy/report issue.

W115. SOS/emergency assistance screen.

W116. Emergency contact and help confirmation.

Do not present GPS or QR checks as secure unless the backend actually validates them.

Do not show a successful attendance state before the server confirms the event.

## H. Earnings and payments

W117. Earnings overview.

W118. Available versus pending balance, only if supported by the actual ledger.

W119. Earnings by completed shift.

W120. Individual shift payment breakdown.

W121. Payment pending state.

W122. Payment completed state.

W123. Payment failed state.

W124. Payout account details.

W125. Payout history.

W126. Transaction details.

W127. Download invoice or payment receipt, if available.

W128. Financial issue/report problem screen.

W129. Empty earnings state.

W130. Earnings-loading and error states.

Clearly distinguish earned wages, approved amounts, pending payments, and money actually paid.

Do not invent a wallet, escrow, payout guarantee, or balance if the backend does not support it.

## I. Notifications, support and account settings

W131. Notifications inbox.

W132. Application update notification.

W133. Shift reminder notification.

W134. Cancellation or schedule-change notification.

W135. Payment update notification.

W136. Notification preferences.

W137. Help center.

W138. Contact support.

W139. Report a safety concern.

W140. Submit a dispute.

W141. Profile and account settings.

W142. Privacy and permissions.

W143. Change phone or email.

W144. Logout confirmation.

W145. Account deletion request and confirmation.

W146. Offline mode.

W147. General server-error recovery.

---

# 4. ORGANIZER APP — COMPLETE SCREEN INVENTORY

Create a separate Organizer App section using the same design system but with business-oriented information architecture.

## A. Registration and company setup

O01. Organizer splash screen.

O02. Organizer welcome screen.

O03. Organizer registration.

O04. Phone or email verification.

O05. Organizer login.

O06. Forgot-password and recovery flow, if supported.

O07. Company or agency profile introduction.

O08. Business name and legal entity details.

O09. Business address.

O10. GSTIN entry and validation, where applicable.

O11. Business document upload.

O12. Authorized representative details.

O13. Business profile review.

O14. Verification submission confirmation.

O15. Organizer verification pending.

O16. Organizer verification approved.

O17. Organizer verification rejected with reason.

O18. Resubmission flow.

O19. Verification-required restriction screen when attempting to publish shifts.

O20. Edit organization profile.

## B. Dashboard and navigation

O21. Organizer dashboard.

O22. Dashboard with no shifts yet.

O23. Dashboard with active shifts.

O24. Upcoming event overview.

O25. Applications requiring review.

O26. Confirmed worker count.

O27. Upcoming attendance summary.

O28. Shift performance overview using actual data only.

O29. Notifications inbox.

O30. Search and filter across shifts.

O31. Organizer navigation drawer or bottom navigation.

O32. Loading, offline, and dashboard-error states.

Do not create decorative KPI cards filled with invented numbers. When there is no data, show a useful empty state and an action to create the first shift.

## C. Create and publish a shift

O33. Create Shift introduction.

O34. Choose event or shift type.

O35. Job title and role description.

O36. Responsibilities and eligibility requirements.

O37. Required skills.

O38. Number of workers needed.

O39. Event date selector.

O40. Start time and end time.

O41. Break duration and payable working hours.

O42. Hourly wage entry.

O43. Total estimated wage calculation.

O44. Work venue and full address.

O45. Map pin and venue confirmation.

O46. Reporting instructions.

O47. Dress code and equipment requirements.

O48. Supervisor contact information.

O49. Application deadline.

O50. Review shift details.

O51. Validation errors for missing or invalid fields.

O52. Save draft, if supported.

O53. Publish confirmation.

O54. Publishing progress.

O55. Shift successfully published.

O56. Publication failure and retry.

O57. Edit shift.

O58. Cancel shift with reason and confirmation.

O59. Duplicate shift warning.

O60. Shift capacity and eligibility validation.

O61. Published shift detail.

O62. Shift status history.

Prevent publishing until all server-required fields and business verification requirements are satisfied.

## D. Applicant management and roster

O63. Applicants overview.

O64. Applicant list.

O65. Applicant detail.

O66. Worker skills and experience.

O67. Verification status indicator.

O68. Application review.

O69. Accept/confirm worker action.

O70. Decline applicant action.

O71. Bulk selection, only if supported.

O72. Confirmed worker roster.

O73. Pending confirmation list.

O74. Replacement worker workflow.

O75. Worker withdrawal or cancellation.

O76. Capacity-full state.

O77. Worker contact action with appropriate privacy controls.

O78. Roster search and filtering.

O79. Live application status updates.

O80. Applicant notification status, if available.

O81. Empty applicant list.

O82. Failed roster loading and retry.

O83. Roster export, if supported.

Never invent worker identities, ratings, skills, or verification badges. Display only real data permitted for that organizer.

## E. Event-day management

O84. Event-day dashboard.

O85. Today's shifts.

O86. Shift attendance roster.

O87. QR scanner interface, if supported by the implementation.

O88. Scan in progress.

O89. Valid check-in confirmation.

O90. Invalid, expired, or duplicate QR result.

O91. Worker check-in status.

O92. Worker check-out status.

O93. Late or absent worker indicator.

O94. Attendance correction request.

O95. Emergency contact and incident report.

O96. Live staffing count.

O97. Shift completion confirmation.

O98. Attendance summary.

O99. Post-event worker feedback, if supported.

O100. Event-day network-error and scanner-recovery states.

The scanner must validate attendance with the backend. A locally generated success animation is not sufficient.

## F. Finances, invoices and billing

O101. Financial overview.

O102. Shift-related financial summary.

O103. Invoice list.

O104. Invoice detail.

O105. Invoice download or share.

O106. Platform fee breakdown.

O107. GST/tax breakdown, using verified business rules.

O108. Payment status.

O109. Pending versus settled amounts.

O110. Transaction history.

O111. Refund or adjustment details, if supported.

O112. Billing information.

O113. GSTIN and billing address editing.

O114. Financial report export, if supported.

O115. Empty finance state.

O116. Financial error and reconciliation issue.

Never claim that a payment was settled unless the authoritative payment or ledger state confirms it. Do not invent escrow, payouts, tax treatment, or financial guarantees.

## G. Organizer account, support and settings

O117. Organization profile.

O118. Authorized team members, if supported.

O119. Role and permission management, if supported.

O120. Notification preferences.

O121. Security and session settings.

O122. Change email or phone.

O123. Support and help center.

O124. Report a platform issue.

O125. Account suspension or verification restriction.

O126. Logout confirmation.

O127. Account deletion request.

O128. Offline and reconnection state.

O129. General error recovery.

---

# 5. REQUIRED SCREEN STATES

For every major screen, design the applicable states instead of creating only the ideal happy path.

1. Initial/loading.
2. Normal content.
3. Empty state.
4. Validation error.
5. Network failure.
6. Permission denied.
7. Pending approval.
8. Successful completion.
9. Disabled action.
10. Expired session.
11. Unauthorized access.
12. Stale data requiring refresh.
13. Retry and recovery.
14. Destructive-action confirmation.
15. Offline/reconnection.

Not every state applies to every screen. Use judgment, but never omit a critical failure or recovery state.

---

# 6. NAVIGATION AND INFORMATION ARCHITECTURE

### Worker navigation

Use four primary destinations:
- Discover
- My Shifts
- Earnings
- Profile

Use clear secondary navigation for applications, attendance, KYC, notifications, support, and settings.

Keep the primary navigation stable. Avoid hiding critical actions in complicated menus.

### Organizer navigation

Use a business-focused navigation system with:
- Dashboard
- Shifts
- Create Shift
- Roster/Applicants
- Finances
- Profile

On smaller screens, use a compact bottom navigation with the primary create action easy to find. On larger screens, adapt the layout without duplicating or hiding functionality.

### Flow integrity

Design the entire sequence from the first launch to a completed real transaction.

Worker:
Registration → Profile → KYC submission → Admin approval → Discovery → Application → Organizer confirmation → Shift preparation → Check-in → Check-out → Earnings/payment status.

Organizer:
Registration → Business details → Verification submission → Admin approval → Create shift → Publish → Review applications → Confirm workers → Event-day attendance → Shift completion → Invoice and financial reconciliation.

Show how users return to unfinished tasks, recover from errors, and understand why an action is blocked.

---

# 7. INTERACTION DESIGN

Design realistic prototypes for:
- Tab navigation.
- Back navigation.
- Form progression.
- Validation errors.
- OTP entry.
- Document uploads.
- Filters and sorting.
- Swipe left/right.
- Apply confirmation.
- Shift creation wizard.
- Applicant acceptance.
- Cancellation confirmation.
- QR scanning states.
- Attendance confirmation.
- Invoice viewing.
- Notifications.
- Bottom sheets.
- Empty-state calls to action.

Use consistent transitions and restrained motion.

Never imply that a button is functional simply because it looks clickable. Clearly distinguish designed interactions from actual backend integrations.

---

# 8. ACCESSIBILITY AND RESPONSIVENESS

Ensure:
- Readable contrast in monochrome mode.
- Large touch targets.
- Visible focus and selected states.
- Labels that do not rely on color alone.
- Accessible error messages.
- Screen-reader-friendly control naming.
- Dynamic text compatibility.
- No clipped text at larger font sizes.
- Keyboard-safe forms.
- Safe areas on notched devices.
- Scrolling for long forms.
- Layouts that work on compact and large phones.

Use clear language that a first-time worker or event organizer can understand without technical knowledge.

---

# 9. REALISM AND DATA INTEGRITY

This is a production marketplace design, not a demo.

Never populate screens with fabricated:
- Worker profiles.
- Organizer identities.
- Jobs or shifts.
- Ratings and reviews.
- Application counts.
- Earnings.
- Invoices.
- Payment records.
- Verification results.

Use clearly labeled empty states and placeholders in the design presentation.

Use realistic field examples only where needed to explain form structure, and clearly label them as examples rather than live data.

If a feature is not present in the actual application or backend, label it as a proposed feature and do not imply that it is already implemented.

Use Indian context where relevant:
- ₹ currency formatting.
- Indian phone numbers.
- IST time display.
- Mumbai venue examples in explicitly labeled design examples.
- Appropriate date and time formatting.
- GSTIN and identity verification only where legally and operationally appropriate.

Never expose full Aadhaar, PAN, bank account numbers, OTPs, access tokens, or private contact details in public-facing screens.

---

# 10. DELIVERABLES

Organize the Canva project into clearly named sections:

01 — Brand and Design Tokens
02 — Reusable Components
03 — Worker Onboarding and Authentication
04 — Worker Profile and KYC
05 — Worker Discovery and Applications
06 — Worker Shifts and Attendance
07 — Worker Earnings and Settings
08 — Organizer Onboarding and Verification
09 — Organizer Dashboard
10 — Shift Creation and Management
11 — Applicants and Roster
12 — Event-Day Operations
13 — Organizer Finances
14 — Shared Error, Empty and Loading States
15 — Full User Journey Maps
16 — Mobile Interaction Prototypes

Create one clearly named frame per screen. Keep screen names and identifiers consistent with the inventory above.

Include:
- Complete high-fidelity mobile screens.
- Reusable component library.
- Consistent design tokens.
- Navigation and user-flow maps.
- Critical interaction prototypes.
- Empty/error/loading variants.
- A final screen inventory showing which screens are complete.
- A list of proposed features that need engineering or backend support.

If the entire inventory cannot fit in one generation, work in sequential batches. Preserve the exact design tokens, typography, navigation, and interaction rules across all batches. Do not silently skip screens or replace multiple screens with one generic dashboard.

# FINAL QUALITY BAR

The result should feel like a premium, trustworthy, minimal Indian workforce marketplace.

A new worker should immediately understand:
- How to create an account.
- Why identity verification is required.
- Where to find relevant shifts.
- What they will earn.
- Whether they are confirmed.
- How to report to work.
- How attendance is verified.
- What their payment status means.

A new organizer should immediately understand:
- How to verify their organization.
- How to publish a shift.
- How to set accurate wages and times.
- How to review applicants.
- How to confirm workers.
- How to manage event-day attendance.
- How to understand invoices and payment status.

Prioritize clarity, trust, consistency, accessibility, and real-world usability over visual decoration.

Build the complete system screen by screen. Do not stop after designing the welcome screen, dashboard, or a handful of attractive mockups.