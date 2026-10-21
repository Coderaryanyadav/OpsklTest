# PRODUCTION GAP REGISTER

**Commit:** `5722d4e` (+ in-progress health route / docs this session)

| ID | Sev | Gap | Evidence | Owner action / fix path | Status |
| --- | --- | --- | --- | --- | --- |
| PG-001 | P1 | Worker/organizer **device E2E** not executed | Maestro YAML present; no sim | Run Maestro + Expo on device with test accounts | OPEN / BLOCKED (env) |
| PG-002 | P1 | Live **SMS OTP delivery** not proven | GoTrue policy PASS only | Configure Twilio/MessageBird (or Supabase SMS) + capture delivery | OPEN / BLOCKED |
| PG-003 | P1 | **No bank payout / VAN** while earnings UI exists | Code honesty + MISSING rails | Either wire sandbox payout or keep “ledger only” forever | NEEDS_DECISION |
| PG-004 | P2 | Push delivery unverified | scripts/edge present | Configure FCM/APNs + dispatch smoke | OPEN |
| PG-005 | P2 | Admin **production deploy** not performed | Build PASS only | Deploy Next to host; set secrets; smoke `/api/health` | OPEN / BLOCKED (access) |
| PG-006 | P2 | EAS store builds not run | `eas.json` | `eas build --profile production` with credentials | OPEN / BLOCKED |
| PG-007 | P2 | No Sentry/observability vendor | code scan | Optional wire + DSN | OPEN |
| PG-008 | P2 | CI workflow may be incomplete | inspect `.github` | Add typecheck/test/build gates | IN_PROGRESS check |
| PG-009 | P3 | `NEXT_PUBLIC_DEFAULT_CITY/TIMEZONE` unset locally | baseline env scan | Zod defaults Mumbai/IST — optional sync `.env` | LOW |
| PG-010 | P1 | Cross-tenant RLS live probe suite limited | SQL suite covers RPC guards | Dedicated anon JWT cross-tenant script | PARTIAL |
| PG-011 | P2 | `confirm_worker_booking_safe` still immediate-confirm | intentional parallel to offer RPC | Product: deprecate or document crew force-confirm | NEEDS_DECISION |
| PG-012 | P2 | Health endpoint missing historically | — | **FIXED** `/api/health` this session | FIXED |

## Launch rule mapping

- Any OPEN P1 in PG-001/002/003 for a claimed “full marketplace with SMS + mobile + payouts” → **NO-GO**
- Soft launch (admin + API + ledger-only, invite-only organizers) may be **GO WITH DOCUMENTED LIMITATIONS** if PG-001–003 accepted as exclusions
