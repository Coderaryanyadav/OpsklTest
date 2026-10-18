# PHASE 4 — REAL MARKETPLACE BUSINESS LOGIC

Implement the actual marketplace lifecycle. Do not add fake records or simulate successful operations.

## Worker discovery and applications

- Discover only genuinely available, appropriately public shifts.
- Use correct hourly wage filtering.
- Make location, date, category and wage filters composable.
- Handle pagination without duplicate or missing results where feasible.
- Exclude ineligible, closed, expired, filled and already-applied shifts according to documented rules.
- Persist swipe passes safely.
- Prevent duplicate applications.
- Support withdrawal only if the business rules permit it.
- Make query failures visibly different from empty results.
- Use safe shift projections instead of exposing private job columns.

## Organizer workflow

- Create, save, edit, publish and cancel shifts.
- Persist every supported field.
- Prevent editing completed shifts in ways that alter historical records.
- Handle capacity reductions, application cutoffs and cancellations explicitly.
- Show real applicant status.
- Confirm workers through an authorized server-side operation.
- Keep roster counts and application states consistent.
- Use realtime updates as a convenience, not as the sole source of truth. Refresh authoritative state after reconnection.

## Concurrency and state transitions

- Make worker confirmation atomic with capacity checks.
- Prevent overbooking under concurrent requests.
- Enforce valid state transitions on the server.
- Make retries idempotent where repeated requests could create side effects.
- Define how cancellations, replacement workers and organizer changes affect confirmed bookings.
- Do not let stale clients overwrite newer records.
- Use explicit error codes and meaningful recovery paths.

## Required integration test

Run a real test using two separate worker accounts, one organizer account and one administrator account:

1. Worker registers and submits KYC.
2. Admin approves the worker.
3. Organizer registers and submits verification.
4. Admin approves the organizer.
5. Organizer creates and publishes a shift.
6. Worker discovers and applies for the shift.
7. Organizer sees the real application.
8. Organizer confirms the worker.
9. Worker sees the authoritative confirmed status.
10. Repeated requests do not create duplicate applications or bookings.
11. A second worker cannot exceed available capacity.
12. Cross-account access is rejected.

Use isolated test accounts and a disposable database. Clean up test records safely. Record actual results, including failures.
# PHASE 5 — OPSKL UNIVERSAL UI/UX DESIGN SYSTEM

Before redesigning individual screens, inspect the current components, navigation and visual inconsistencies across Worker, Organizer and Admin.

## Visual identity

Use a premium, restrained, Apple-inspired black-and-white system.

Tokens:
- Black `#000000`
- White `#FFFFFF`
- Secondary background `#F5F5F5`
- Subtle surface `#FAFAFA`
- Primary text `#111111`
- Secondary text `#737373`
- Dividers `#E5E5E5`
- Disabled controls `#D4D4D4`

Avoid decorative blue, purple, green and teal. Use restrained semantic colors only for accessible errors, warnings, success and safety states.

## Design tokens

Define and consistently reuse:
- Typography scale.
- Spacing scale.
- Border radii.
- Button heights.
- Icon sizes.
- Form field dimensions.
- Navigation dimensions.
- Modal and bottom-sheet behavior.
- Focus, hover, pressed, selected and disabled states.
- Shadows and separators.
- Light/dark theme tokens.
- Motion and transition rules.

Follow the existing architecture; do not create a second component system that duplicates current components.

## Universal component library

Create or refine:
- Primary, secondary, destructive and disabled buttons.
- Text fields, password fields and OTP inputs.
- Search, date, time, wage and location fields.
- Dropdowns, toggles, radios and checkboxes.
- Shift cards and worker cards.
- Status chips.
- Applicant rows and rosters.
- Document upload and preview components.
- Tables and financial summaries.
- Bottom navigation and headers.
- Dialogs, bottom sheets and confirmations.
- Toasts and inline errors.
- Loading skeletons.
- Empty states.
- Retry/offline states.
- Permission explanations.
- Pagination and filter controls.

## Required interaction states

For every applicable screen, design and implement:
- Loading.
- Real data.
- Empty.
- Validation failure.
- Server failure.
- Offline.
- Permission denied.
- Pending verification.
- Success confirmed by the server.
- Disabled action with explanation.
- Expired session.
- Stale data and refresh.
- Destructive-action confirmation.

## Responsive and accessible design

- Never clip headings, buttons or tabs.
- Avoid cramped dashboard metrics.
- Keep forms keyboard-safe.
- Respect device safe areas.
- Support small and large screens.
- Use accessible contrast and meaningful labels.
- Use touch targets of approximately 44–48 points or larger.
- Support dynamic text where the platform permits it.
- Do not rely on color alone to communicate status.

## Output

Document the component inventory and tokens in `docs/ui/DESIGN_SYSTEM.md`. Implement shared components using the existing framework and avoid rewriting business logic during this phase.

Review the actual rendered screens at representative phone sizes before declaring the design system complete.
# PHASE 6 — COMPLETE WORKER APP UI/UX AND FUNCTIONALITY

Use the established design system. Inspect every current Worker route, screen, modal, hook and navigation state. Redesign and repair the actual application, not just a prototype.

## A. Entry and authentication

Implement the appropriate screens for:
- Splash and welcome.
- Role selection where needed.
- Signup, login and OTP.
- Email/phone verification.
- Password recovery if supported.
- Account recovery and expired sessions.
- Terms, privacy and consent.
- Authentication loading and errors.

Do not show unsupported sign-in providers.

## B. Profile and identity

Implement:
- Profile completion.
- Personal details.
- Photo upload.
- Skills and experience.
- Work preferences.
- Preferred locations.
- Availability.
- Language preferences.
- Emergency contact.
- Payout details only where required.
- Profile review and editing.
- KYC introduction, upload, preview, submission, pending, approved, rejected, resubmission and technical failure.

Clearly explain why a protected action is blocked.

## C. Discover and search

Implement:
- Discover feed.
- Swipe deck.
- List view.
- Shift details.
- Search.
- Filters for location, date, hourly wage and category.
- Sorting.
- Location permission and manual location selection.
- Venue details.
- Organizer information restricted to permitted fields.
- No nearby shifts.
- No filter results.
- Loading skeletons.
- Network failure.
- Closed or filled shifts.
- Saved shifts only if supported.

Make hourly wage, total shift pay, date, duration, location and requirements easy to compare. Label total pay and hourly pay separately.

## D. Applications and My Shifts

Implement:
- Apply confirmation.
- Application progress and confirmed success.
- Pending, accepted, declined and withdrawn states where applicable.
- Application history.
- Duplicate-application handling.
- KYC/profile eligibility blocks.
- Upcoming shifts.
- Completed and cancelled shifts.
- Reporting instructions.
- Schedule conflicts.
- Calendar/navigation handoffs.
- Rescheduling and cancellation messages.
- Empty and failure states.

Do not show an application as successful before the server confirms it.

## E. Attendance and event day

Implement:
- Pre-shift checklist.
- Reporting instructions.
- Location permission.
- GPS validation and insufficient-accuracy states.
- Out-of-geofence state.
- Eligible check-in.
- Secure QR/code generation only if supported by the backend.
- Code expiry and regeneration.
- Successful check-in and check-out.
- Active shift.
- Attendance history.
- Attendance disputes.
- Emergency assistance.

The backend must validate attendance. Client-side location checks or animations are not authoritative.

## F. Earnings, support and settings

Implement:
- Earnings overview.
- Completed-shift breakdown.
- Pending and completed payment statuses.
- Payout history if supported.
- Transaction details.
- Receipts/invoices if available.
- Financial issue reporting.
- Notifications.
- Help and support.
- Safety reporting.
- Profile/settings.
- Privacy and permissions.
- Logout.
- Account deletion.
- Offline and error recovery.

Never fabricate a balance, completed shift, payout or transaction.

## Navigation

Preserve a simple primary navigation:
- Discover.
- My Shifts.
- Earnings.
- Profile.

Place secondary screens in clear, predictable locations.

## Acceptance criteria

Every existing Worker screen must be accounted for in a route inventory. Every screen must use real application state, have correct loading/error/empty states, and call the actual backend where appropriate.

Add or update tests for navigation, forms, eligibility blocks, application state, error handling and accessibility. Verify the app at compact and large mobile sizes.
# PHASE 7 — COMPLETE ORGANIZER APP UI/UX AND FUNCTIONALITY

Redesign the actual Organizer Expo app using the shared monochrome design system.

## A. Registration and verification

Implement:
- Organizer welcome and authentication.
- Company/agency registration.
- Business name and legal entity.
- Address.
- GSTIN and required business documentation.
- Authorized representative.
- Review and submit.
- Pending, approved, rejected and resubmission states.
- Profile editing.
- Expired session and authentication errors.

Do not allow an unverified organizer to publish shifts. Enforce the restriction on the server.

## B. Dashboard

Create a clear dashboard for:
- Active shifts.
- Upcoming events.
- Applications requiring review.
- Confirmed workers.
- Attendance status.
- Relevant real financial summaries where supported.
- Notifications and next actions.

For a new organizer, show a meaningful empty dashboard and a clear first action. Never populate the dashboard with sample metrics.

Avoid dense KPI cards, tiny labels, unnecessary charts and decorative visualizations.

## C. Shift creation and management

Implement a guided, accessible shift wizard:
- Role/title.
- Description and responsibilities.
- Skills and eligibility.
- Worker count.
- Date.
- Start/end times.
- Break duration.
- Hourly wage.
- Payable hours and total estimated pay.
- Venue and address.
- Map pin and coordinates.
- Reporting instructions.
- Dress code/equipment.
- Supervisor contact where permitted.
- Application deadline.
- Review.
- Draft and publish if supported.
- Edit and cancellation.
- Success, validation and retry states.

Enforce the same business rules in client validation and server/database logic.

Display wage and estimated total clearly. Do not claim a break is unpaid or paid unless the product's actual rules specify it.

Persist every supported field, including deadlines. Reject invalid coordinates, past shifts and unsupported lifecycle transitions.

## D. Applicants and roster

Implement:
- Applicant list.
- Applicant detail.
- Permitted worker profile and verification information.
- Skills and experience.
- Pending review.
- Confirm and decline actions.
- Confirmed roster.
- Capacity-full state.
- Withdrawal and replacement workflows where supported.
- Search and filtering.
- Real status updates.
- Empty and failed-loading states.
- Reconnection and refresh.

Prevent cross-organization data access. Use realtime subscriptions where supported and reconcile with authoritative server state.

## E. Event-day operations

Implement:
- Today's events.
- Attendance roster.
- QR scanner only if the backend supports it.
- Valid/invalid/expired/duplicate scan results.
- Check-in/out status.
- Late/absent indicators.
- Attendance correction requests.
- Incident reporting.
- Staffing count.
- Shift completion.
- Network/scanner recovery.

## F. Finance and settings

Implement:
- Invoice list/detail.
- Verified fee and tax breakdown.
- Payment statuses.
- Transactions and reconciliations.
- Billing profile.
- Financial exports only where supported.
- Notifications.
- Organization profile.
- Authorized team management only if implemented.
- Security and account settings.
- Support, logout and deletion requests.

Never present an invoice, payment or settlement as final unless the authoritative backend confirms it.

## Acceptance criteria

The Organizer can complete a real workflow from registration and verification through shift publication, worker confirmation, attendance and financial record review. Test each state and failure path using isolated real test accounts.

Create a screen inventory covering every current route and modal. Report any proposed feature that requires additional backend work instead of pretending it already works.
# PHASE 8 — ADMIN PORTAL AND CROSS-PLATFORM OPERATIONS

Audit and improve the Next.js Admin portal and every shared operational workflow.

## Admin authentication and access

- Secure admin login and session handling.
- Server-side role enforcement on every privileged route and mutation.
- No client-side-only admin bypass.
- Proper unauthorized, expired-session and permission-denied screens.
- No hardcoded test credentials in production.

## Verification review

Build a usable review queue for:
- Worker KYC cases.
- Organizer business-verification cases.
- Pending, approved, rejected and resubmitted cases.
- Document preview through authorized private access.
- Approve/reject actions with reasons.
- Review history.
- Concurrent reviews.
- Failed submissions and retry.

Prevent duplicate or conflicting decisions. Record who performed each sensitive action.

## Admin dashboard and tables

- Use actual database records and aggregates.
- Show meaningful empty states.
- Search, filter, sort and paginate accurately.
- Handle long names, large result sets and narrow screens.
- Avoid misleading counts.
- Distinguish loading, error and empty results.
- Protect exports and document access.

## Cross-platform notifications

Inspect the actual notification implementation.

- Persist notification records where required.
- Trigger notifications from authoritative events.
- Avoid duplicate notifications when events are retried.
- Handle permission denial and delivery failures.
- Provide read/unread states if supported.
- Ensure a notification opens the correct authorized record.
- Do not expose private information in push-notification previews.
- Treat realtime and push notifications as delivery mechanisms, not the source of truth.

## Error handling and auditability

- Standardize structured error codes.
- Replace raw database errors with safe, actionable messages.
- Preserve diagnostic details in access-controlled logs.
- Never log secrets, OTPs, access tokens or private document contents.
- Add correlation IDs where appropriate.
- Make privileged actions traceable.

## Acceptance criteria

Test admin authorization directly at the API/database boundary. Verify that ordinary users cannot access review functions, exports or other organizations' data by changing URLs, IDs or request bodies.

Document any functionality that is intentionally out of scope or requires additional provider configuration.
# PHASE 9 — COMPLETE REGRESSION, SECURITY AND UI/UX QA

Do not rely on a successful screenshot, mocked test, or successful build as proof that Opskl works.

## 1. Clean environment

- Install dependencies from the repository's lockfile.
- Record runtime and package-manager versions.
- Identify unsupported or missing dependencies.
- Run formatting/lint checks, TypeScript checks, unit tests and builds using the repository's real scripts.
- Do not suppress errors or weaken compiler/test settings to obtain a green result.

## 2. Database and API tests

- Apply the complete migration chain to a disposable database.
- Test the upgrade path from the previous schema.
- Verify RPC signatures and client arguments.
- Test RLS and storage policies with different user roles.
- Test authorization failures.
- Test database constraints, null values, boundaries and invalid states.
- Test concurrent bookings and duplicate requests.
- Test deadlines, wages, breaks, coordinates and shift status transitions.
- Test rollback behavior after partial failure.

## 3. Real end-to-end marketplace tests

Using isolated accounts and real test infrastructure:
1. New worker registration.
2. Worker profile completion.
3. Worker KYC submission.
4. Admin review and approval.
5. Organizer registration.
6. Organizer verification and approval.
7. Organizer shift creation.
8. Shift discovery and filtering.
9. Worker application.
10. Organizer roster update.
11. Worker confirmation.
12. Duplicate-request protection.
13. Attendance and checkout where implemented.
14. Invoice and financial state verification where implemented.
15. Cancellation and error recovery.

Test rejected verification, failed uploads, expired sessions, offline behavior, duplicate taps, stale screens and server failures.

Use a sandbox payment provider if payment integration exists. Never simulate real payment success.

## 4. Visual regression and UX audit

Review every screen and major state at representative compact and large mobile sizes.

Check:
- Clipped titles and tab labels.
- Keyboard covering controls.
- Overflow and horizontal scrolling.
- Safe areas.
- Touch-target size.
- Typography and contrast.
- Inconsistent spacing and radii.
- Empty/loading/error states.
- Repeated or confusing actions.
- Broken back navigation.
- Unclear blocked actions.
- Misleading status indicators.
- Screen-reader labels and keyboard access where applicable.
- Light/dark theme consistency.

Capture screenshots or use available visual-test tooling when the environment supports it. Do not claim a visual inspection was performed if the screens were not actually rendered.

## 5. Automated quality gates

Add or improve:
- Unit tests.
- Component tests.
- API integration tests.
- Database integration tests.
- End-to-end tests.
- Authorization tests.
- Regression tests for each fixed defect.

The suite must fail when a critical assertion fails. A warning must not be counted as a passing test.

## Deliverables

Produce `docs/audit/PHASE-9.md` with exact commands, pass/fail results, environment details, test coverage, known gaps and screenshot references where available.

Do not claim all tests pass unless they were executed and verified.
# PHASE 10 — PRODUCTION READINESS AND FINAL HANDOVER

Perform the final release audit only after Phases 0–9 have been completed or their blockers explicitly documented.

## Configuration and deployment

- Validate Worker, Organizer and Admin production configuration.
- Configure genuine EAS project IDs and build profiles.
- Verify deep links, URL schemes, app identifiers and platform permissions.
- Verify production and staging are separated.
- Validate environment variables without exposing their values.
- Check Supabase URLs, redirect URLs, authentication settings and storage configuration.
- Verify push notification setup only if supported.
- Confirm migration deployment order and backup/recovery procedures.
- Confirm production builds do not contain development authentication bypasses or test credentials.

## Security release gate

- No known committed production secrets remain unaddressed.
- No unsafe database rebuild or broad permission script can accidentally target production without explicit safeguards.
- No public access to private identity, business, banking or attendance data.
- No unauthorized privileged RPC execution.
- No client-side-only verification or role enforcement.
- No known critical authorization bypass.
- All unresolved security findings are documented and assigned severity.

## Product release gate

- Worker and Organizer onboarding work with empty data.
- Every visible action has a real outcome or is clearly identified as unavailable.
- No fake dashboards, fabricated records or simulated payment success.
- All supported shift fields persist correctly.
- Wage, break and deadline rules are consistent.
- Application and booking states are authoritative.
- Errors are visible and recoverable.
- Responsive screens have been reviewed.
- No known critical regression remains.

## Final report

Create:
- `docs/audit/FINAL_REPORT.md`
- `docs/audit/KNOWN_ISSUES.md`
- `docs/audit/RELEASE_CHECKLIST.md`
- Updated architecture and screen inventories.
- A list of changed files and the reason for each change.
- A list of database migrations added or modified.
- Test commands and actual outputs.
- Remaining blockers, unverified risks and required external configuration.

For each defect, record:
1. Identifier.
2. Severity.
3. File and line evidence.
4. Original behavior.
5. Corrected behavior.
6. Regression test.
7. Actual test result.
8. Remaining limitations.

Separate confirmed fixes, verified passes, unverified items and not-applicable features.

Do not mark Opskl production-ready if a critical security test, required build, migration test or core user journey remains unverified.

Finish by giving me a concise release decision: READY, READY WITH DOCUMENTED LIMITATIONS, or NOT READY, supported by evidence.
Before proceeding to the next phase, stop and verify the current phase against its acceptance criteria.

1. Show the files actually changed.
2. Explain the defect or design problem each change addresses.
3. Run the relevant tests and report the actual exit codes/results.
4. Identify any tests that could not run and explain why.
5. Review the final diff for accidental changes, security regressions, broken flows and inconsistent UI.
6. Confirm that no fake data, mock production behavior, hardcoded credentials or security bypasses were introduced.
7. List incomplete work explicitly.

Do not claim success based on code generation alone. Do not move to the next phase while a critical blocker remains unresolved. Fix the blocker first, then retest.