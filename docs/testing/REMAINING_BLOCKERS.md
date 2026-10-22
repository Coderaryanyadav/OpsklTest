# Remaining blockers and unverified scope

**Date:** 2026-10-22
**Status of scoped Docker/web/API run:** PASS
**Status of full platform readiness:** PARTIAL

Nothing below is reported as passing. Each item is either **BLOCKED** by the
available environment or **NOT RUN** for safety/scope reasons.

## 1. Native mobile execution

| ID | Blocker | Impact | Status | How to unblock |
| --- | --- | --- | --- | --- |
| BLK-01 | No iOS simulator or Android emulator/device was run inside the standard Linux Docker environment | Native layouts, navigation, lifecycle, and platform APIs are unverified | **BLOCKED** | Run signed development builds on a macOS iOS simulator and a physical Android device |
| BLK-02 | No native camera, GPS, motion, permission, or background execution test | The web checks cannot prove native check-in, geofence, photo evidence, or permission flows | **BLOCKED** | Use Detox/Maestro or manual device tests with controlled location and camera fixtures |
| BLK-03 | No native push token registration or delivery | APNs/FCM registration, notification delivery, and deep links are unverified | **BLOCKED** | Use provider sandboxes and test devices with real push credentials |
| BLK-04 | No device offline/queue/replay test | Offline mutation queue and reconciliation are unverified | **BLOCKED** | Run airplane-mode/network-flap scenarios on device against a disposable backend |
| BLK-05 | No app-store signing, archive, TestFlight, or Play internal-track build | Store distribution is unverified | **BLOCKED** | Run the release playbook with signing credentials in a secure CI environment |

The Worker and Organizer Docker images are Expo **web** exports. They must not
be cited as native app evidence.

## 2. External providers

| ID | Blocker | Impact | Status | How to unblock |
| --- | --- | --- | --- | --- |
| BLK-06 | No real SMTP/email delivery | Sign-in/OTP/notification email delivery and bounce handling are unverified | **BLOCKED** | Use a provider sandbox with a dedicated test domain |
| BLK-07 | No real SMS/OTP delivery | Phone OTP delivery, rate limits, and provider errors are unverified | **BLOCKED** | Use a disposable SMS sandbox and synthetic numbers |
| BLK-08 | No APNs/FCM credentials | Native push delivery is unverified | **BLOCKED** | Use test apps and provider sandboxes |
| BLK-09 | No real Razorpay/payment or escrow provider | Authorization, capture, refunds, webhooks, settlement, and reconciliation are unverified | **BLOCKED** | Use the provider's test mode and verify webhook signatures in staging |
| BLK-10 | No bank/UTR reconciliation | Real payout settlement and bank status are unverified | **BLOCKED** | Use provider sandbox/pilot accounts with test beneficiaries |

The Docker suite's funding, payout, and settlement checks are explicit
test-ledger state transitions. They are not provider settlements and must not
be represented as such.

## 3. Production and staging

| ID | Blocker | Impact | Status | How to unblock |
| --- | --- | --- | --- | --- |
| BLK-11 | No production/staging Supabase project was used | Production schema drift, grants, RLS, pooler JWT behavior, and secret rotation are unverified | **BLOCKED** | Apply the same migration set to a dedicated staging project and rerun the SQL/RLS matrix |
| BLK-12 | No connection-pooler test | Pooler transaction/session behavior and JWT propagation are unverified | **BLOCKED** | Run API/RLS suites through the staging pooler with the same real sessions |
| BLK-13 | No load, soak, or HA test | Throughput, contention, retry storms, and failover are unverified | **BLOCKED** | Run k6/Artillery load tests and a controlled failover exercise in staging |
| BLK-14 | No production observability/alert test | Logs, metrics, traces, and alert routing are unverified | **BLOCKED** | Inject faults in staging and verify dashboards/alerts |
| BLK-15 | No webhook retry/dead-letter verification | Provider webhook retries and idempotency at the edge are unverified | **BLOCKED** | Replay signed webhook fixtures through the staging endpoint |

## 4. Application areas not covered by this run

| ID | Blocker | Impact | Status | How to unblock |
| --- | --- | --- | --- | --- |
| BLK-16 | No Supabase Realtime delivery assertion | Live roster/chat/notification updates are unverified | **BLOCKED** | Add browser/WS subscription tests and assert delivery/reconnect |
| BLK-17 | No Edge Function execution | The one existing Edge Function is unverified | **BLOCKED** | Invoke it against the local/staging stack with synthetic payloads |
| BLK-18 | Chromium only | Safari/iOS WebKit and Firefox behavior are unverified | **BLOCKED** | Add Playwright WebKit/Firefox projects or device browser tests |
| BLK-19 | No manual accessibility/visual review | Screen-reader behavior, focus order, contrast, and visual regressions are unverified | **BLOCKED** | Run axe + manual keyboard/screen-reader review and visual snapshots |
| BLK-20 | Admin verification/dispute actions only via API | The Admin UI review buttons were not driven end-to-end | **PARTIAL** | Add browser actions for approve/reject/resolve with synthetic cases |
| BLK-21 | Worker apply/check-in and organizer offer through UI not driven | Those flows are verified at the API/RPC layer, not the UI layer | **PARTIAL** | Add browser workflows with controlled geolocation and time |
| BLK-22 | Existing remote Admin Playwright spec | `apps/admin/e2e/admin_dashboard.spec.ts` loads `.env.local`, which points at a remote Supabase project | **NOT RUN** | Point it at the disposable stack or keep it out of the Docker suite |

## 5. Test-environment limitations

| ID | Limitation | Impact | Status |
| --- | --- | --- | --- |
| BLK-23 | Test runner runs Chromium with `--no-sandbox` as a disposable container | Not a production browser configuration | **ACCEPTED TEST-ONLY** |
| BLK-24 | Attendance checkout uses service-role timestamp time-travel | Avoids a 15-minute real wait in a disposable DB; the checkout RPC still validates | **ACCEPTED TEST-ONLY** |
| BLK-25 | Local Supabase demo keys are used | Not production secrets; file is gitignored and mode `600` | **ACCEPTED TEST-ONLY** |
| BLK-26 | Local Supabase is not HA/production-sized | Performance and failure behavior are not representative | **BLOCKED for production claims** |
| BLK-27 | Evidence PNGs/logs are gitignored under `test-artifacts/` | They exist on the validated machine but are regenerated by the command | **BY DESIGN** |

## 6. Current release statement

- **PASS:** local Dockerized Admin/Worker/Organizer web targets, fresh
  migrations, real Auth/PostgREST/RLS workflows, and browser smoke flows.
- **PARTIAL:** full platform readiness, because native and provider paths are
  not exercised.
- **BLOCKED:** native devices, external providers, production/staging behavior,
  load, Realtime, Edge Function, and cross-browser verification.
- **FAIL:** none in the executed suites.

The two open P3 product issues from the prior audit remain tracked in
`docs/audit/REMAINING_BLOCKERS.md`; this Docker pass did not reclassify them.
