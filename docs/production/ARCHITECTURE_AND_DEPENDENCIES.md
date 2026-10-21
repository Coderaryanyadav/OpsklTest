# ARCHITECTURE AND DEPENDENCIES

**Commit:** `5722d4ec196465a639ab7a4a4d106254cfc32133`

## Runtime topology

```
Worker (Expo) ──┐
Organizer (Expo)┼── @opskil/shared ── Supabase JS (anon) ── Postgres RLS/RPC
Admin (Next.js)─┘         │
                          ├── Storage (verification-documents)
                          └── Service role (server routes / scripts only)
```

## Apps

| App | Stack | Entry | Auth |
| --- | --- | --- | --- |
| Worker | Expo Router + RN | `apps/worker/app` | Phone OTP via Supabase |
| Organizer | Expo Router + RN | `apps/organizer/app` | Email/password + profiles |
| Admin | Next.js 15 App Router | `apps/admin/src/app` | Cookie session + middleware role=`admin` |

## Shared packages

| Package | Responsibility |
| --- | --- |
| `@opskil/shared` | Clients, RPC wrappers, payments calculator, offline queue, killswitch |
| `@opskil/design-system` | Tokens / RN components |
| `@opskil/validation` | Zod (GSTIN, wage floor, schemas) |

## Database

- Migrations under `supabase/migrations/`
- Critical RPCs: `create_job_safe`, `apply…`, `select_worker_offer_safe`, `confirm_worker_booking_safe`, `worker_confirm_selection_safe`, `worker_decline_selection_safe`, `check_in_worker_safe`, admin resolve/moderate helpers
- RLS enabled on core tables; workers cannot UPDATE bookings directly (accept/decline via SECURITY DEFINER)

## Deploy surfaces discovered

| Surface | Evidence | Status |
| --- | --- | --- |
| Admin web | `npm run build:admin`, Next | Build verified |
| Mobile | `eas.json` per app | Config present; EAS submit **NOT RUN** |
| Edge functions | `supabase/functions/` partial | Push dispatch present |
| Docker | none at root | N/A |
| CI | inspect `.github` if present | See gap register |

## Dependency notes

- npm workspaces; lockfile committed
- Client bundles must never include `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` (enforced by naming + tests)
