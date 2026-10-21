# INTEGRATION REGISTER

| Integration | Implementation | Config | Verified | Launch role |
| --- | --- | --- | --- | --- |
| Supabase Auth (GoTrue) | shared + admin SSR | URL + anon | Reachability + OTP policy check PASS | **Required** |
| Supabase Postgres | migrations + RPC | `DATABASE_URL` | Live SQL suite PASS | **Required** |
| Supabase Storage | verification-documents | anon session | Unit/path; live upload device NOT RUN | **Required** for KYC |
| Expo Push | `dispatch_push` / edge fn | FCM/APNs unknown | NOT RUN | Optional soft-launch |
| SMS OTP | GoTrue phone | provider in Supabase dashboard | Delivery NOT RUN | **Required** for worker login |
| Email OTP | GoTrue | Resend/SMTP | Policy check only | Organizer/admin |
| Bank VAN / IMPS / UPI payout | absent | — | MISSING | Blocker if marketing claims payouts |
| Razorpay / NPCI | absent | — | MISSING | Optional later |
| UIDAI / OCR | absent | — | MISSING (honest) | Not required if manual KYC |
| WhatsApp | absent | — | MISSING (honest) | Not required |
| BLE mesh | absent | — | MISSING (honest) | Not required |
| Error monitoring (Sentry etc.) | not wired | — | MISSING | Recommended |
| EAS Build / Submit | `eas.json` | Expo account | NOT RUN | Required for store |
| Admin hosting | Next build | `NEXT_PUBLIC_APP_URL` | Build PASS; deploy NOT RUN | Required |

## Mocked vs live evidence

| Layer | Mode |
| --- | --- |
| Jest unit | Mocked Supabase RPC |
| `test:sql` | Live non-prod Postgres |
| Playwright admin | Live Supabase auth + UI |
| Maestro | NOT RUN |
| Payment webhooks | N/A |
