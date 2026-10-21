# DEFECT_LOG

**Commit baseline:** `169451cd1d58dbf68ae1e635347c84ba96174545`  
**Remediation:** see `REMEDIATION_SESSION.md` (after-fix evidence separate from baseline).

| ID | Sev | Title | Status | Evidence / notes |
| --- | --- | --- | --- | --- |
| D-ENV-001 | P1 | Live Supabase pooler unreachable | **CLOSED** | Was sandbox DNS; live `test:sql` EXIT 0 (`evidence/test-sql-rerun.txt`) |
| D-ENV-002 | P1 | Device/browser E2E not executed | **PARTIAL** | Admin Playwright **5/5 PASS**; Maestro/Expo **NOT RUN** |
| D-ENV-003 | P1 | Live SMS OTP not verified | **OPEN** | GoTrue reachability PASS in check_all; carrier OTP **NOT RUN** |
| D-ENV-004 | P2 | Push notification delivery unverified | **OPEN** | — |
| D-TEST-001 | P2 | Selection-control matrix not exercised | **OPEN** | — |
| D-TEST-002 | P1 | Jest “e2e” suites are mocked | **OPEN** (process) | Naming gap remains |
| D-PROD-001 | P2 | Escrow wording risk | **OPEN** | Job moderation still shows ESCROW column label |
| D-SEC-001 | P2 | Incident photo URIs may be local-only | **FIXED** (code) | Upload + reject device URIs; unit PASS |
| D-SEC-002 | P1→verify | RLS effectiveness unproven live | **PARTIAL** | Live SQL RPC guards PASS; dedicated cross-tenant suite still open |
| D-HYG-001 | P2 | `.env` files on disk | **OPEN / HUMAN** | gitignored patterns present; values not printed |
| D-FEAT-001 | P2 | WhatsApp/SMS prefs without delivery | **OPEN** | — |
| D-FEAT-002 | P3 | Stitch blue vs monochrome DS | **NEEDS HUMAN REVIEW** | — |
| D-FEAT-003 | P2 | Admin Playwright unrun | **CLOSED** | `evidence/playwright-e2e-final.txt` EXIT 0 |

## Severity counts (still open)

| Sev | Count |
| --- | --- |
| P0 | 0 confirmed |
| P1 | 2 open (OTP live; Jest naming) + D-SEC-002 partial |
| P2 | several (push, selection matrix, escrow label, prefs, env hygiene) |
| P3 | 1 |
