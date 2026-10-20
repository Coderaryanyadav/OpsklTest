# OPSKL — Google Stitch Phase-by-Phase Product Design Prompts

## How to use this document

- Create a **new Stitch project** for Opskl. Stitch has no source-code context, so every prompt below is self-contained enough to guide the relevant phase.
- Run **one phase at a time**. Ask Stitch to keep the same design system and extend the existing project rather than restarting or replacing earlier screens.
- Review the result before moving on. If Stitch creates only a few screens, ask it to finish the missing screen list in that phase before continuing.
- Give Stitch creative freedom over layout, visual hierarchy, component composition, motion concepts, and navigation patterns. The non-negotiable constraints are the product workflow, truthful states, accessibility, and privacy.
- Use realistic but clearly illustrative sample data only in the design prototype. Never imply it is live data.
- Stitch creates designs/prototypes; it does not prove backend, authentication, GPS, KYC, notifications, or payments actually work.

---

# PHASE 0 — Product foundation, design direction, and information architecture

**Prompt to paste into Stitch:**

You are a principal product designer and design systems lead creating Opskl from scratch. Opskl is a professional marketplace for short-duration and single-day event staffing, initially for Mumbai, India. There are three distinct product experiences: a Worker mobile app, an Organizer mobile app, and an Admin web console. This is a real product concept, not a student project, not a marketing landing page, and not a generic dashboard template.

Your task in this phase is to establish the product's information architecture and a distinctive visual direction. Do not design only a landing page. Explore a few creative visual directions, choose the strongest one, and explain why it improves trust, speed, clarity, and usability. You have freedom to experiment with typography, layout, navigation, card composition, spacing, restrained motion, and interaction patterns.

**Brand direction:** premium, confident, human, operationally clear, modern, and calm. Use black, white, and neutral greys as the foundation. You may propose one restrained accent only if it materially improves meaning or recognition; do not add colour merely for decoration. Avoid generic gradients, excessive shadows, glassmorphism, huge empty hero areas, piles of cards, tiny grey text, overuse of pills, emoji icons, and copied Apple/Ola/Uber screens. Use those products only as inspiration for clarity, motion restraint, and task flow—not as templates to imitate.

**Design for India and Mumbai:** use ₹ for money, IST for times, familiar Indian date formats, Mumbai locality examples such as BKC, NESCO/Goregaon, and South Mumbai where relevant. These are example locations, not claims of live job availability. Keep wage basis explicit (per hour or per shift). Do not invent statutory or legal claims.

Create an information architecture for all three experiences:

1. Worker mobile: welcome/authentication, profile setup, verification/KYC status, Discover, search/filter, shift details, application submission, application status, selected/awaiting confirmation, confirmed shifts, My Shifts, attendance/check-in/out, earnings/payment status, notifications, help/safety, profile/settings, logout and account deletion.
2. Organizer mobile: welcome/authentication, business profile, verification status/submission, overview, shifts list, create/edit shift, review/publish/moderation state, applicants, worker selection, confirmation roster, event-day attendance, attendance review, finance/invoices/payment status, notifications, support, profile/settings, account deletion.
3. Admin web: secure login, overview/action queues, worker verification, organizer verification, shift moderation, worker directory, organizer directory, shift detail, dispute queue/detail, safety reports, audit logs, operational settings/emergency controls, access-denied/session-expired states.

**Non-negotiable workflow truth:** applying is not hiring; selected is not confirmed; checked-in is not checked-out; attendance approval is not payment; a payment initiated is not paid; entering a GSTIN or UPI handle is not verification. KYC pending, rejected, approved, expired, and technical failure are distinct states. Show only data appropriate to the viewer's role. Never show full Aadhaar/PAN in general profiles or organizer rosters.

**Deliverables for this phase:**
- One chosen visual direction and a short rationale.
- Design tokens: palette, type scale, spacing, radii, borders, elevations, icon style, interaction states.
- Navigation map for Worker, Organizer, Admin.
- A screen inventory listing every screen to design in later phases.
- Reusable component inventory.
- Motion principles: fast, subtle, purposeful; reduced-motion alternative.
- Accessibility rules: readable contrast, visible focus, labels, touch targets, non-colour status cues.

Do not claim any screen or integration is already implemented. End by preparing the design system for the next phase and keeping the project consistent.

---

# PHASE 1 — Worker app: onboarding, authentication, profile, and KYC

**Prompt to paste into Stitch:**

Continue the existing Opskl Stitch project and preserve the approved design direction and tokens. Design the complete Worker onboarding and identity-verification journey as connected mobile screens, not disconnected mockups. Use a polished, production-minded interface with clear hierarchy, low friction, and honest explanations.

Create these screens and states:
1. Welcome/intro screen explaining the value simply, with clear Sign in and Create account actions. Do not force a user into the feed as if they are authenticated.
2. Sign-in method selection based only on the product's supported methods; include email/phone OTP screens as design variants if needed, but label unsupported methods as proposed rather than implemented.
3. Enter contact detail, OTP entry, resend countdown, invalid/expired OTP, network error, rate-limited state, success, and return-to-login states.
4. Terms/privacy consent screen with readable links and explicit consent controls where required.
5. Profile setup: full name, contact details, locality, skills/roles interested in, availability/preferences, and any fields confirmed by the product requirements. Use suitable pickers rather than requiring users to type date/time formats manually.
6. Profile incomplete state and saved-progress/resume state.
7. KYC explanation/consent screen; document type selection; secure upload/capture design; upload progress; upload failure/retry; pending review; approved; rejected with reason and resubmission; expired/needs-action; unavailable/technical failure.
8. Account restricted/suspended state and account deletion request flow, including confirmation and consequences.
9. Permission explanation screens only for permissions genuinely needed. Do not request location or camera permissions without context.

UX rules:
- Do not claim a phone, email, identity document, bank account, or UPI handle is verified just because a format looks valid.
- Never display full Aadhaar/PAN after upload; use masked identifiers and secure-document language.
- Do not imply government API/DigiLocker/provider integration unless explicitly available; label it as a proposed integration if not confirmed.
- Avoid raw server errors. Provide plain-language error copy, recovery action, and support path.
- OTP screens should have clear focus, paste/autofill-friendly design, resend countdown, and edit-contact option.
- Keep the number of steps low, but do not hide consent or important consequences.
- Include loading, empty, offline, validation, error and success states.

Prototype links must connect every forward/back/retry/resume path. Use fictional sample values only. Deliver all screens and a short journey map; do not move to Worker discovery until onboarding is complete.

---

# PHASE 2 — Worker app: Discover, search, filters, shift details, and application

**Prompt to paste into Stitch:**

Continue the existing Opskl design. Design the complete Worker shift-discovery and application experience. The user is looking for trustworthy single-day event work and must understand the role, pay, schedule, location, requirements, and application state quickly.

Create these screens/states:
1. Discover feed for a new eligible worker with no application history.
2. Discover feed with existing listings and applied-state indicators.
3. Search results, no results, filters open, selected filters, reset filters, and filter results empty.
4. Location/locality selection and location permission denied/unavailable states. Never pretend to have GPS or live distance if the app has no verified location data.
5. Shift card variants for open, applied, selected/awaiting confirmation, confirmed, filled, expired, cancelled, and restricted/ineligible where applicable.
6. Full shift detail with role, organizer's public-safe information, wage amount and basis, date, start/end time, duration, locality/venue, responsibilities, requirements, dress code, break/meal/transport information only when supplied, reporting instructions, cancellation terms, safety contact/path, and clear application CTA.
7. Application review/confirmation screen if appropriate to the actual flow.
8. Application submitting, success (application received—not hired), duplicate application, already applied, KYC pending/rejected, profile incomplete, shift filled/expired/cancelled, offline/server error, and retry states.
9. Optional swipe-discovery concept with a complete card and visible alternative list navigation. Swiping right must not silently apply without an explicit confirmation/review step. Swiping left must not be the only way to dismiss or navigate.
10. Saved shifts and empty saved state only if included in the information architecture.

Visual requirements:
- Make role, pay, date/time, locality, and key eligibility information scannable in seconds.
- Keep card content concise; avoid six-to-ten metadata chips.
- Use consistent iconography and text labels; no emoji icons.
- Do not place multiple competing primary CTAs on one card.
- Show real information hierarchy rather than decorative photos. Any sample data must be clearly illustrative.
- Keep filters easy to clear, including a visible All/Any option where relevant.
- Provide skeletons, pull-to-refresh concepts, empty/error/offline states, and readable long-content layouts.

Use a clear bottom navigation only if it supports the established information architecture. Connect the prototype from Discover → detail → application → accurate pending state → application status. Include back navigation and error recovery. Never show “You're hired” after applying.

---

# PHASE 3 — Worker app: My Shifts, confirmation, attendance, earnings, notifications, profile

**Prompt to paste into Stitch:**

Continue the Opskl project and design the rest of the Worker post-application experience. Focus on operational clarity on the day of a shift, especially for users in a busy venue with limited time or weak connectivity.

Create these screens/states:
1. My Shifts overview with sensible tabs/sections for Upcoming, Needs action, In progress, Past/Completed, and Cancelled only if consistent with the product model. A brand-new user must see a helpful empty state, not a broken or confusing blank screen.
2. Application details: applied/pending review, not selected, withdrawn, or cancelled.
3. Selected and awaiting worker confirmation, including a clear confirm/decline choice and consequences.
4. Confirmed shift detail with venue address, map/navigation action concept, reporting time, organizer contact rules, instructions, and cancellation policy.
5. Shift-day readiness checklist and reminder detail.
6. Check-in flow: explain required location permission, show location-checking, within-geofence, outside-geofence, permission denied, GPS unavailable, code invalid/expired, server unavailable, and successful check-in states. Do not imply GPS verification if no actual location data is available.
7. Short-lived check-in code screen if the product's backend supports it. Show countdown, refresh/expiry handling, privacy warning and clear instruction about who scans or submits the code. Do not invent cryptographic guarantees.
8. Check-out flow with confirmation and accurate status.
9. Attendance under review, attendance approved, attendance disputed, no-show/cancelled states as applicable.
10. Earnings summary and details separating estimated, pending, processing, paid, on-hold, refunded, and disputed amounts only where the domain supports those statuses. Do not call unpaid amounts “earned” or “paid.”
11. Notifications list, unread/read, empty/error state, notification preferences, and a deep-link destination screen. Do not invent notifications or credit confirmations.
12. Profile, skills, availability, contact verification status, privacy/settings, help/safety/report issue, logout and account deletion.

Critical rules:
- A confirmed booking can become past due; do not leave it forever in Active with a check-in button.
- Check-in and check-out are distinct.
- Attendance approval and payment settlement are separate.
- Do not display “UPI verified” based only on regex validation.
- Do not show fake earnings, fake bank credits, fake organizer details, or fabricated notifications.
- Do not display a misleading “Phone verified” status for an email-only account.
- Make safety/report support easy to find without making the SOS action easy to trigger accidentally.

Use contextual, short, calm copy and large clear actions. Connect the prototype across every state, including recovery from GPS/network failure. End with a complete Worker screen checklist and note any backend-dependent states as design-only.

---

# PHASE 4 — Organizer app: onboarding, business verification, dashboard, and shift creation

**Prompt to paste into Stitch:**

Continue Opskl with a distinct Organizer mobile experience. Organizers manage event staffing and need to post accurate shifts, review applicants, and understand financial commitments. Do not reuse Worker navigation or merely recolour Worker screens.

Create these screens/states:
1. Organizer welcome/authentication and role selection where needed.
2. Business profile setup: legal/business name, business type, contact details, business address and other fields actually required by the product. Clearly distinguish required and optional data.
3. Verification submission/review: not submitted, draft, pending, approved, rejected with reason, resubmission, technical failure. Include document upload/progress/error states without exposing sensitive details to workers.
4. Organizer home/dashboard for a new account with no shifts. Give a helpful first-action flow, not fabricated statistics or prefilled jobs.
5. Dashboard for an existing organizer with action queues driven by illustrative sample data clearly labelled as prototype data.
6. Shift list with draft, pending moderation, published/open, paused, filled, in progress, completed, and cancelled states where applicable.
7. Multi-step shift creation wizard with progress: role/title and duties; headcount; date/time/reporting time; venue/address/locality; coordinates/map pin if the product supports it; wage amount and pay basis; requirements/skills; conditions such as dress code, meals, breaks, transport only if applicable; cancellation/attendance instructions; review and save draft/submit/publish.
8. Date/time pickers and clear validation states; do not ask users to type raw ISO date/time strings.
9. Live listing preview that resembles the Worker shift detail card/page.
10. Save draft, submit for moderation, moderation pending, published, validation failure, unavailable verification, and server/network error states.
11. Edit/cancel shift confirmation with clear consequences for existing applicants and confirmed workers.
12. Draft management and a clear path to continue editing/publishing drafts if supported by the product.

Workflow rules:
- An unverified organizer must see why publishing is blocked and a clear path to submit verification.
- Do not display “Verified GST Registered” because a user typed a GSTIN.
- Do not label a shift published until the product state says it is published.
- Wage estimate and final amount must use the same duration/pay basis; clearly label estimates.
- Never invent a map pin, GPS coordinates, worker count, event, or live metric.
- Do not call a wage threshold a legally compliant “living wage” unless that is established by the product/legal requirements. Use neutral copy such as “Rate meets the platform minimum” only if the rule is confirmed.

Design an efficient step-by-step flow with save/resume, validation inline, review before submission, and a clear success state. Connect every screen and error recovery path. Finish with the full screen list and state inventory.

---

# PHASE 5 — Organizer app: applicants, crew roster, attendance, finance, and account

**Prompt to paste into Stitch:**

Continue the Opskl Organizer design. Build the operational screens needed after shifts are published. Prioritize clear statuses, fast roster management, safe high-impact actions, and trustworthy money information.

Create:
1. Shift overview/detail with status, schedule, venue, headcount and actions appropriate to its current state.
2. Applicant list with search/filter/sort, applicant detail, relevant skills/availability and only privacy-safe public profile fields.
3. Applicant states: applied, shortlisted if supported, selected/awaiting confirmation, not selected, withdrawn, and duplicate/invalid state if relevant.
4. Select/decline confirmation with clear consequences and notification state. Do not make selection look like final confirmation.
5. Confirmed crew roster, worker confirmation pending, worker declined, replacement needed, and roster full states.
6. Crew briefing/instructions editor and send status only as a design for a real supported action. If sending is not implemented, do not present it as successful.
7. Event-day attendance console: expected crew, checked in, checked out, late, absent/no-show, issue/dispute, and attendance needing review where supported. Exclude cancelled/no-show people from “all present” calculations where appropriate.
8. Individual attendance review with scheduled hours, reported/verified hours, correction/reason, evidence and confirm action only where supported. Do not prefill hours as verified without evidence.
9. Finance overview separating wage obligation, platform fee, tax on platform fee, organizer total, invoice state, and payment state where those calculations exist. Mark estimates as estimates.
10. Invoice list/detail and empty states. Do not invent sequential invoice numbers or claim statutory invoice compliance in a mockup.
11. Payment pending/processing/paid/failed/refunded/disputed states only if supported by the actual model. Never show a successful transfer just because a button was tapped.
12. Notifications, business profile, verification badge/status, settings, support and account deletion.

Workflow truth:
- Applied ≠ selected; selected ≠ confirmed; checked in ≠ completed; attendance approved ≠ paid.
- Do not expose Aadhaar/PAN, UPI identifiers, private contact details, or KYC documents in general roster views.
- Keep all high-impact actions explicit and confirm cancellations or attendance adjustments.
- No fake “payout processing initiated” success message unless a real action exists.
- Fee and GST figures must be visually separated and transparently labelled; the intended model discussed is 10% platform fee and 18% GST on that fee, but the design must not pretend the legal/accounting treatment is confirmed.

Create connected prototypes from published shift → applicant review → selection → worker confirmation → event-day roster → attendance review → honest finance/payment state. Include loading, empty, error and retry screens. End with a screen/state checklist.

---

# PHASE 6 — Admin web console: queues, review tools, disputes, safety, audit, settings

**Prompt to paste into Stitch:**

Continue Opskl with a desktop-first but fully responsive Admin web console. This is a sensitive operational tool. Design for accuracy, prioritization, traceability and prevention of accidental high-impact actions—not decoration.

Create all of these screens and states:
1. Admin sign-in, invalid credentials, loading, session expired, unauthorized/access denied, and return/redirect state.
2. Main shell with responsive sidebar, clear page title, breadcrumbs where useful, account menu and notifications if supported.
3. Overview with actionable queues and truthful metrics. Do not use fabricated “100% genuine events,” “zero incidents,” or other unsupported claims.
4. Worker verification queue with pending-first sorting, search, filters, pagination, status and submission age.
5. Worker verification detail with relevant identity/profile context, secure document preview concept, masked sensitive data, document status, decision history, approve/reject confirmation, rejection reason and resubmission state.
6. Organizer verification queue/detail including business name/type and relevant submitted business documents; do not show only an anonymous profile ID when safe context is available.
7. Shift moderation queue/detail with actual organizer context, shift terms, moderation reasons and appropriate approve/reject/needs-changes actions. Never offer “approve/reopen” for completed/cancelled records without a valid transition.
8. Worker and organizer directories with detail views and safe data visibility.
9. Disputes queue prioritised by status/severity/age, dispute detail with booking context, parties, relevant timeline/evidence and decision controls. Distinguish investigate, under review, resolved, dismissed and other real states.
10. Safety report queue with severity sorting, reporter/reported context subject to permissions, evidence, investigate/escalate/resolve/dismiss paths only where supported.
11. Audit log with real actor attribution, timestamp, action, target and readable before/after changes; include pagination/filtering concepts. Never invent IP addresses or actor names.
12. Operational settings and emergency pause/resume. Require a confirmation modal, reason, impact summary and explicit final action. Do not trigger a marketplace-wide pause with one casual click.
13. Loading skeletons, no pending items, no search results, query error, permission denied, stale data, action failure and action success states.

Design rules:
- Strong table hierarchy, readable text and aligned monetary/date columns.
- Responsive record cards or focused detail views for tablets/phones; no clipped tables.
- Accessible labels, keyboard focus, modal semantics, Escape behavior and clear destructive-action warnings.
- Hide unnecessary personal information; UI visibility does not replace server authorization.
- Do not show fake health metrics, live data or successful backend actions.
- Use status text plus restrained semantic colour, not colour alone.

Use a coherent neutral palette consistent with the mobile apps while allowing dense admin information to remain readable. Create a connected prototype from overview → queue → case detail → decision confirmation → updated queue. Include audit-log visibility and errors. Finish with a complete admin screen inventory.

---

# PHASE 7 — Cross-product states, notifications, safety, errors, accessibility, and responsive audit

**Prompt to paste into Stitch:**

Audit the entire Opskl Stitch project as a connected product, not as a set of attractive screens. Preserve the chosen visual system while exploring improvements where they genuinely increase usability. You have freedom to improve layout, navigation, interaction patterns and motion; do not change business semantics.

Create or refine missing shared states across Worker, Organizer and Admin:
- first-use empty states with a clear next step;
- loading skeletons and submit-in-progress states;
- no results, cleared filters and stale data;
- offline, timeout, server failure and retry;
- permission denied and restricted account;
- form validation, duplicate submit and expired session;
- KYC pending/rejected/resubmission;
- shift cancelled/filled/expired;
- selected-awaiting-confirmation and confirmed;
- attendance issue and disputed payment;
- notification permission denied, no notifications, unread/read and destination unavailable;
- support/safety report submission and status;
- logout and account deletion confirmation/progress/result.

Review notification design carefully: a notification must describe a real event/state, have an appropriate destination, and never claim “₹ credited” or “booking confirmed” without the corresponding real event. The design may use clearly fictional examples for prototypes, but label them as examples and never imply they are live.

Review accessibility and device behavior:
- mobile screen sizes, tablet and desktop breakpoints;
- dynamic text/font scaling;
- safe areas and keyboard-open forms;
- visible focus and keyboard navigation on web;
- minimum comfortable touch targets;
- sufficient contrast for small text and status indicators;
- icon labels and non-colour state communication;
- reduced-motion alternatives;
- long names, long venue addresses, large amounts, empty lists and very long forms.

Motion principles: purposeful transitions, subtle card/list feedback, short feedback animations, restrained bottom sheets, clear loading progress. Avoid animation that delays urgent actions, hides content, makes swipe the only control, or simulates a real backend action. Respect reduced-motion preferences.

Deliver a cross-product consistency report, a list of missing states/screens, and improved connected prototypes. Do not introduce fake backend integrations or change the workflow lifecycle.

---

# PHASE 8 — Final Stitch prototype integration and screen completeness check

**Prompt to paste into Stitch:**

Perform a final screen-by-screen and workflow-by-workflow audit of the Opskl design project. Do not start over. Keep the best existing designs and improve weak or missing screens. You have creative freedom to refine the visual language, spacing, hierarchy, motion and component composition, but all workflow semantics must remain accurate.

Verify the design covers the complete paths:

**Worker:** welcome → authentication → profile setup → KYC submission/status → Discover/search/filter → shift detail → apply → application pending → selection/worker confirmation → confirmed shift → shift-day instructions → check-in/out → attendance status → earnings/payment status → notification/support/profile/account deletion.

**Organizer:** authentication → business profile → verification submission/status → empty dashboard → create shift → save draft/review/submit → moderation/publication → applicant review → selection → worker confirmation → roster → event attendance → attendance review → finance/invoice/payment status → support/profile/account deletion.

**Admin:** login/session failure → overview → worker/organizer verification queue → secure case detail → decision and reason → shift moderation → worker/organizer directories → dispute review → safety report handling → audit log → settings/emergency control with confirmation.

For each flow, confirm:
1. Every screen has a clear entry point and exit/back path.
2. Every primary button has a meaningful prototype destination or a clearly labelled unavailable action.
3. Loading, empty, error, denied, pending and success states exist for critical actions.
4. Status labels are consistent across all three roles.
5. Application, selection, confirmation, attendance and payment remain separate states.
6. Sensitive KYC data is not exposed in general worker/organizer screens.
7. No unsupported escrow, wage guarantee, payment success, verified identity, live GPS, push notification, legal compliance, or real-time claims are implied.
8. The UI works at realistic viewport sizes without clipping, tiny text, keyboard overlap or unsafe sticky buttons.
9. Shared components are visually consistent but each role's information architecture remains appropriate.
10. Prototype data is clearly illustrative, not represented as live.

Output a checklist of every screen completed, screens missing, broken prototype links, inconsistent labels, accessibility risks and recommended final polish. Do not claim backend functionality; this is a design/prototype audit only.

---

# Recommended Stitch execution order

1. Phase 0 — foundation and screen inventory.
2. Phase 1 — Worker onboarding and KYC.
3. Phase 2 — Worker discovery and application.
4. Phase 3 — Worker shifts, attendance and account.
5. Phase 4 — Organizer onboarding and shift creation.
6. Phase 5 — Organizer roster, attendance and finance.
7. Phase 6 — Admin console.
8. Phase 7 — shared states, accessibility, responsiveness and motion.
9. Phase 8 — final completeness and prototype-link audit.

## Important engineering handoff note

After Stitch is complete, export or transfer the designs into the coding workflow. The actual codebase must still be audited and implemented separately. Verify real authentication, database state transitions, RLS, storage access, GPS/geofencing, notification delivery, invoicing, payment-provider integration, and account deletion in code and tests. A polished Stitch prototype is not evidence those features work.
