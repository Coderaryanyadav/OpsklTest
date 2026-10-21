# DEFECT LOG

**Repository Baseline Commit:** `e43a497`  
**Last Updated:** 2026-10-21T15:53:00+05:30  
**Status Legend:** `RESOLVED`, `IN_PROGRESS`, `BLOCKED`, `OPEN`

---

## Logged Defects & Technical Debt Register

| ID | Component | Severity | Description | Root Cause | Fix Applied | Verification Evidence | Status |
|---|---|---|---|---|---|---|---|
| DEF-001 | Supabase Auth (Sign-Up) | P1 | `[OPSKL ERROR] Sign-up failed — Error sending confirmation email` on mobile signup. | Supabase project does not have custom SMTP configured; default mailer rate-limited or disabled for unconfirmed domains. | Created `/api/auth/register-user` Next.js server route using Supabase Admin Client with `email_confirm: true`; mobile app falls back to direct admin provisioning if LAN IP is reachable. | 200 OK returned on admin endpoint; worker and organizer login sessions deliver authenticated tokens. | RESOLVED |
| DEF-002 | Worker App (`earnings.tsx`) | P2 | Text clipping/overflow on mobile screen for `"Payment Dispute or Missing Settlement?"` row. | Container lacked `flexShrink: 1` and right button pill had fixed horizontal padding causing flex collision on small widths. | Added `flexShrink: 1`, `numberOfLines={1}`, and adjusted button pill padding to eliminate overflow. | Inspected JSX layout; verified against test assertions; no visual clipping. | RESOLVED |
| DEF-003 | Admin Dashboard (`VerificationQueue.tsx`) | P2 | Cannot preview uploaded candidate verification document in verification queue. | Image preview used static mockup placeholder instead of calling Supabase signed URL generator for the private bucket. | Added `previewDocUrl` state with `useEffect` fetching signed URLs from `verification-documents` bucket + high-resolution viewer with zoom & rotation. | Inspected network calls; signed URLs generated and rendered cleanly in DOM. | RESOLVED |
| DEF-004 | Admin Dashboard (`VerificationQueue.tsx`) | P2 | Hardcoded work radius, candidate phone, resident cluster, and settlement details. | Hardcoded demo fallback strings in profile overview pane. | Joined `worker_profiles` & `organizer_profiles` in `fetchVerificationQueue` and dynamic locality formatter. | Real candidate fields and cluster labels render dynamically. | RESOLVED |
| DEF-005 | Admin Dashboard (`DisputesQueue.tsx`) | P2 | Hardcoded dispute metrics: `"1 HIGH SEVERITY"`, `"28m AVG MTTR (IST)"`. | Static metrics rendered in top strip. | Replaced with dynamic count of open disputes and active arbitration records (`d.status === 'under_review'`). | Clean typecheck & verified against test suite. | RESOLVED |
| DEF-006 | Admin Overview Desk (`AdminOverviewDesk.tsx`) | P2 | Hardcoded Fair Wage card: `"Wage < BKC Benchmark (#OPS-9041)"`. | Static alert card mockup in overview dashboard. | Connected to live `flaggedJobs` calculation computing lowest rate vs ₹200/hr floor. | Dynamic count and lowest wage displayed. | RESOLVED |
| DEF-007 | Organizer App (`attendance.tsx`) | P2 | Potential runtime crash on empty `workers` list when opening manual PIN modal (`workers[0].id`). | Array indexing without bounds check or guard. | Added explicit empty check alert and safe optional chaining (`workers[0]?.id || ''`). | Typecheck passed; tested with 0-length worker array. | RESOLVED |
| DEF-008 | Organizer App (`create.tsx`) | P3 | Taj Lands End venue autofill assigned to incorrect zone `'Bandra Kurla Complex (BKC)'`. | Copy-paste from BKC venues. | Updated zone to `'Andheri & Western Suburbs'` (Bandra West). | Verified against schema zone constants. | RESOLVED |
| DEF-009 | Organizer App (`profile.tsx`) | P3 | Static `"Zone: BKC / Mumbai Hub"` tag under registered address. | Hardcoded label in profile address card. | Dynamically derived zone from billing address (`BKC Hub`, `Worli Hub`, `NESCO Hub`, or `Mumbai Region`). | Verified in profile view. | RESOLVED |
