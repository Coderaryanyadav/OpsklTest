OPSKL — INDEPENDENT PHASE-BY-PHASE VERIFICATION MASTER PROMPT
Fresh evidence only. No trust in previous reports, tests, or completion claims.
ROLE
Act as an independent principal QA engineer, full-stack auditor, application security tester, database/RLS reviewer, mobile and web test engineer, and product workflow verifier.

Your mission is to independently determine what actually works, what is broken, what is incomplete, what is insecure, and what has merely been claimed to work.

Treat every previous result as an unverified lead. Reproduce it from current source and fresh evidence.

Do not report a test as passed unless you execute it now or obtain direct, current, independently verifiable runtime evidence. If the environment prevents execution, mark it BLOCKED or NOT RUN—not PASS.
1. Non-negotiable rules
1. Begin from the current repository state. Record commit/hash if available, branch, working-tree status, and timestamp.
2. Inspect the code and configuration yourself. Do not rely on prior summaries.
3. Inspect the Stitch ZIP independently, including every screen folder, screenshot, HTML, phase prompt, architecture matrix, and design-system file.
4. Do not trust previous test output. Re-run required checks from a clean, documented state.
5. Do not trust old screenshots as proof of current runtime behavior.
6. Do not treat seeded/demo data, mocked APIs, static JSON, placeholder handlers, or hardcoded success messages as proof of a working backend.
7. Record baseline findings before modifying code.
8. If fixing is in scope, fix defects in a controlled manner and rerun affected tests.
9. Never weaken authentication, authorization, validation, RLS, or security checks to make tests pass.
10. Never use production customer data, real payment transactions, or destructive production actions for testing.
11. Redact secrets, tokens, personal data, identity documents, and sensitive values.
12. Never claim a command passed unless it was run and its exit code inspected.
13. A successful build is not proof workflows work; a rendered screen is not proof controls work.
14. Do not silently skip flaky, failing, unavailable, or environment-dependent checks.
15. Keep baseline defects distinct from defects introduced by fixes.
16. Use precise statuses: PASS, FAIL, BLOCKED, NOT RUN, PARTIAL, NEEDS HUMAN REVIEW.
17. A test passes only when expected behavior and actual evidence are recorded.
18. Do not mark a phase complete while critical tests are blocked or critical defects remain.
2. Establish a clean baseline
Before changing code:
- Identify repository root, applications, packages, backend, database, and integrations from actual files.
- Record commit, branch, and uncommitted changes if Git is available.
- Inspect package managers, lockfiles, runtime versions, scripts, environment requirements, and test configuration.
- Inventory test suites, mocks, fixtures, credentials, and CI workflows.
- Identify which tests use mocks and which require live services.
- Do not use old reports as passing evidence.
- Run validation commands supported by the actual project: dependency/lockfile checks, lint, type checking, unit/integration tests, mobile bundling, web production build, migration checks, and security scans where available.
- Do not invent scripts or claim commands ran if they did not.
- Never print environment variable values; record only required variable names and whether configuration is present.
For each command record the exact command, working directory, runtime version if relevant, exit code, result summary, mocks/live service usage, evidence path, and environmental limitations.

Create docs/verification/BASELINE.md.
3. Build a fresh verification inventory
Create these new artifacts in docs/verification/:
- BASELINE.md
- SCREEN_AND_ROUTE_INVENTORY.md
- FEATURE_PARITY_MATRIX.md
- WORKFLOW_TEST_MATRIX.md
- API_AND_DATABASE_MATRIX.md
- SECURITY_TEST_MATRIX.md
- PHASE_RESULTS.md
- DEFECT_LOG.md
- FINAL_VERIFICATION_REPORT.md
Base them on current code and fresh tests, not copied old reports.

For every Stitch screen and actual route, record:
- Exact design folder and app/platform.
- Current route and source file.
- Whether it is reachable.
- UI elements and selection options.
- Expected and observed behavior.
- API/database dependencies.
- Relevant states and test IDs.
- Evidence, status, and design/implementation gaps.
For every feature, record whether it is verified, broken, UI-only, backend-only/unreachable, missing, blocked by external dependency, or not applicable with justification. Include implementation locations, evidence, severity, and remaining gaps.
4. Test every feature through the complete stack
For each feature, test the relevant path:
Screen → interaction → local state → validation → service/API → authentication → authorization → database/external integration → response → UI state.

Test positive, negative, boundary, repeat-action, and relevant failure cases:
- Initial load, loading, empty, success, failure, timeout.
- Invalid/missing input and boundary values.
- Duplicate taps/submissions.
- Back navigation and state retention.
- Refresh/reopen behavior.
- Unauthorized access and cross-user/cross-organization access.
- Offline behavior where supported.
- Accessibility and touch targets for core flows.
For every selection control:
- Verify options come from the correct source.
- Test every option or every meaningful option category.
- Verify single-select/multi-select rules and selected/unselected/disabled states.
- Verify values persist across navigation and submission.
- Verify downstream screens and calculations use the selected value.
- Verify invalid combinations are rejected and unavailable options cannot be selected.
- Verify changing/resetting a choice updates dependent fields correctly.
A visible but behaviorally untested option is not verified.
5. Phase-by-phase verification
Phase 0 — Repository integrity and reproducibility
Verify package boundaries, lockfiles, scripts, imports, route definitions, secrets exposure, test reproducibility, and setup instructions. Record baseline failures before changes.
Phase 1 — Stitch design-to-code parity
Inspect every screen folder, screenshot, and HTML. Verify all screens are mapped, routes reachable, controls functional, options accounted for, navigation correct, responsive/platform-appropriate, and placeholders documented. Visual similarity alone is not a pass.
Phase 2 — Shared foundation and design system
Verify reusable components, validation, loading/disabled states, dialogs/sheets, date/time and selection controls, design tokens, navigation/route guards, accessibility, and regressions across all apps.
Phase 3 — Worker onboarding, profile, and KYC
Test registration/authentication, OTP success/failure/expiry/resend/rate limits where supported, profile validation and persistence, skill selection, KYC submission and all applicable statuses, document restrictions, eligibility rules, logout/session expiry, and attempts to spoof verification. Use synthetic test documents only.
Phase 4 — Worker marketplace and applications
Test shift data source, search, filters, sorting, categories, dates, locations, wages, combined/cleared filters, empty/error results, shift details, application submission, duplicate prevention, status transitions, withdrawal/cancellation if supported, persistence, eligibility, capacity, and closed/full/expired shifts. An application is not a confirmed booking.
Phase 5 — Worker shifts, attendance, and earnings
Test confirmed versus unconfirmed shifts, briefings, check-in/out rules, geofence/QR if implemented, server-side validation, duplicate/replay protection, invalid location/time, offline queue if supported, attendance disputes, ledger calculations, pending/approved/paid/failed/disputed states, and invoice privacy. Use sandbox/test environments only.
Phase 6 — Organizer setup and shift creation
Test organization ownership, business verification, every shift-wizard step and option, dependent fields, date/time/venue/wage/role/skills/worker count and other designed choices, validation, back navigation, draft persistence, review-before-publish, publication, editing/cancellation, duplicate prevention, and tenant isolation.
Phase 7 — Organizer recruitment, event operations, and finance
Test applicant lists and filters, eligibility, selection/confirmation/rejection/shortlisting where supported, capacity and concurrent selections, duplicate confirmation, crew roster, notifications, attendance consistency, invoices, fee/tax calculations, reconciliation, refunds/disputes/settlement if supported, permissions, and audit trails. Do not assume an “escrow” label means funds are held in escrow.
Phase 8 — Admin portal and privileged actions
Test admin authentication, server-side role enforcement, queues, directories, search/filter/pagination, verification, moderation, disputes, incidents, status reasons, audit logs, settings, emergency controls, direct API access without admin rights, cross-scope access, confirmation dialogs, and duplicate actions. Hiding a button is not authorization.
Phase 9 — Cross-product capabilities
Test notification creation/delivery integration/read state/navigation/retry/duplicates; incident submission/evidence/access/escalation/history; offline queue/retry/idempotency/conflicts and truthful pending/synced state; emergency pause enforcement on intended server paths; and audit/resume controls. If a service is unconfigured, mark BLOCKED and state what is missing. Do not fabricate success.
Phase 10 — End-to-end regression and cross-app consistency
Run fresh end-to-end tests with controlled test accounts and non-production data:
1. Worker onboarding → KYC state → discover → apply → organizer confirms → worker sees confirmed shift.
2. Organizer setup → create → validate → publish → applicants → confirm crew.
3. Confirmed shift → attendance → applicable review → earnings/settlement state.
4. Incident submission → authorized admin review → status and audit update.
5. Admin verification decision → correct user state and eligibility.
6. Finance record → fee/tax calculation → invoice/ledger consistency.
7. Session expiry → protected routes and APIs remain protected.
Use multiple accounts to test ownership boundaries. Verify cross-app updates and identify stale or contradictory states. Rerun all affected checks after every fix.
6. API, database, and security
Create a matrix for important endpoints, server functions, tables/views/triggers, storage buckets, and RLS policies. Verify authentication, authorization, RLS, tenant isolation, server-side validation, constraints, transaction boundaries, idempotency, privilege escalation resistance, secret exposure, sensitive document access, abuse/rate controls where required, safe errors, and fresh database migration setup.

For each security test record actor, resource, attempted action, expected and actual result, and evidence. Use authorized non-production environments only. Never run destructive checks against production.
7. Independently verify calculations
Do not use the app's displayed result as its own test oracle. Find the approved current rule, inspect the implementation, independently calculate expected results, compare outcomes, and test rounding, boundaries, missing values, and repeat processing. Check consistency across apps. If the rule is ambiguous or sources conflict, mark NEEDS HUMAN REVIEW. Do not assume previously documented fees/taxes are correct until confirmed against the current approved source.
8. Evidence requirements
Every important test must include:
- Unique test ID, phase, feature.
- Preconditions and account role.
- Exact steps or command.
- Expected and actual result.
- Status.
- Evidence location.
- Mocked versus live integration indicator.
- Defect ID if failed.
Use fresh command output and exit codes, current test reports, runtime screenshots, automation traces, redacted API responses, database assertions, and source locations as appropriate.

Source inspection can show a route or branch exists; it cannot prove a live integration works. A screenshot proves appearance, not persistence or authorization. A unit test proves isolated logic, not the complete end-to-end workflow. Use the strongest practical evidence for each claim. Never fabricate evidence.
9. Defect severity and fixes
- P0 Critical: data exposure, privilege escalation, unauthorized financial action, severe integrity issue, or major core service failure.
- P1 High: critical workflow blocked, security control ineffective, major corruption, or core role cannot complete essential work.
- P2 Medium: important feature broken, state inconsistency, missing meaningful options, or recurring usability defect.
- P3 Low: minor visual/copy/non-critical interaction defect.
For each defect record reproduction steps, expected/actual, affected role/app, root cause if established, evidence, severity, proposed fix, regression tests, and status.

First preserve baseline results. If fixing is in scope, fix in risk order. Never weaken controls or change business rules without authorization. After each fix, rerun the reproducer, affected suite, and cross-app regression tests. Keep before-fix and after-fix evidence separate.
10. Final independent release decision
In docs/verification/FINAL_VERIFICATION_REPORT.md, include:
1. Exact commit and repository state.
2. Apps/packages covered.
3. Stitch screens/routes inventoried.
4. Feature status counts.
5. Tests passed/failed/blocked/not run.
6. Build/lint/type/unit/integration/E2E/security results.
7. Critical workflows tested.
8. P0–P3 defects and reproduction instructions.
9. Cross-app consistency findings.
10. Database/RLS/authorization findings.
11. Mocked versus live integration coverage.
12. Environment blockers.
13. Remaining feature/design gaps.
14. Fixes and regression evidence.
15. Release recommendation: GO, GO WITH DOCUMENTED LIMITATIONS, or NO-GO.
Release rules:
- Any unresolved P0 = NO-GO.
- Any unresolved P1 in a critical workflow/security boundary = NO-GO.
- A blocked critical test prevents unconditional GO.
- Untested features must not be described as verified.
- A successful build alone never qualifies for GO.
- Report denominator and exclusions; do not inflate pass rates by hiding failures.
11. Execute now
Start with the current repository and both ZIPs. Do not ask me to repeat details already in the files. First record the baseline without changing application code. Then run fresh checks, create the inventory, test every phase, and produce the phase results.

After baseline evidence is preserved, continue into defect reproduction and remediation if the environment permits. If the work exceeds the session, complete a coherent phase, save evidence, and identify the exact next test/phase.

Final principle: trust current, reproducible evidence—not old reports, previous AI claims, screenshots alone, or the mere presence of code.