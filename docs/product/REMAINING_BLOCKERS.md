# OPSKL — Remaining Blockers & External Dependencies

**Document Version:** 1.0.0  
**Status:** Canonical & Strictly Honest  
**Scope:** Production Operational Dependencies, Regulatory Compliance, Vendor Integrations, Hardware Testing  

This document delineates remaining external blockers that prevent full commercial production launch. None of these items are software design omissions; they represent genuine commercial agreements, external credentials, or physical hardware requirements.

---

## 1. External Vendor Credentials & Commercial Contracts

| Dependency Area | Provider / Agency | Blocker Description | Operational Impact | Unblocking Path |
| :--- | :--- | :--- | :--- | :--- |
| **Instant UPI & Bank Payouts** | RazorpayX / Cashfree Payouts | Requires a live corporate escrow account, current account linkage, and production API keys. | Payouts are currently marked `initiated` in the DB ledger; manual wire/NEFT batch settlement required. | Execute corporate banking agreement; deposit initial float; add API secret keys to Supabase Vault. |
| **Production SMS (DLT Header)** | Airtel / Jio / Vodafone Idea via TRAI DLT | Telecom Regulatory Authority of India (TRAI) mandates registered Principal Entity ID and approved SMS templates for OTPs. | SMS fallback uses development Twilio credentials or Supabase Auth dev limits. | Complete enterprise DLT registration on Vilpower / PingConnect; register SMS templates. |
| **Apple APNs Push Certificates** | Apple Developer Enterprise / Organization | Production APNs `.p8` auth key required for background push notifications to physical iOS devices. | Push notifications route via Expo Push development proxy. | Export `.p8` key from Apple Developer Member Center and upload to EAS production credentials. |
| **Automated UIDAI Aadhaar OCR** | Licensed AUA / KUA (e.g. Digio, Karza, HyperVerge) | Commercial API access required for instant automated OCR and biometric Aadhaar validation. | KYC verification currently relies on human review in the Admin Verification Queue. | Sign SaaS contract with certified Indian KYC verification provider. |

---

## 2. Physical Device & Field Hardware Validation

| Hardware Test | Device / Environment | Why It Cannot Be Fully Proven in CI | Pilot Mitigation |
| :--- | :--- | :--- | :--- |
| **Physical GPS Accuracy in MMR Venues** | Low-cost Android devices inside concrete exhibition halls (e.g. NESCO, Jio World Convention Centre) | CI emulators mock location coordinates; physical indoor multi-path reflections and satellite attenuation can degrade accuracy. | On-site supervisor manual attendance override RPC exists as an authorized fallback. |
| **Background Push Notification Wakeup** | iOS and Android battery-optimization / Doze mode | Android manufacturers (Xiaomi, OnePlus) aggressively kill background processes unless battery optimization is disabled. | In-app notification polling and persistent WebSocket channels sync immediately upon foregrounding. |
| **Thermal & Offline Sync Under Stress** | 35°C+ outdoor Mumbai event conditions with spotty 4G/5G connectivity | Network emulators do not simulate hardware radio throttling or high latency packet drops under heavy cell tower congestion. | Local SQLite offline queue with exponential backoff and deduplicated idempotency keys is implemented. |

---

## 3. Legal, Human Operations & Policy Decisions

1. **Escrow & Nodal Account Structuring:**  
   Under Reserve Bank of India (RBI) Payment Aggregator / Payment Gateway guidelines, holding funds on behalf of organizers before releasing to workers may classify Opskl as a payment intermediary. Legal counsel must formally sign off on the escrow / settlement flow.
2. **Minimum Shift Wage Compliance:**  
   The platform enforces a technical floor of ₹100/hr, but statutory Maharashtra minimum wage rates for hospitality/temporary staff must be set in `platform_settings` per municipal district.
3. **Admin On-Call Operational SLA:**  
   Dispute adjudication and safety incident queues require real human operators during live events (typically Fri–Sun evenings). An on-call rotation roster must be established before running multi-shift events.

---

## 4. Unsupported Claims & Explicitly Deferred Capabilities

To maintain engineering integrity, the following claims are explicitly rejected and removed from current marketing/technical documentation:
- **No "Guaranteed Instant Settlement":** Settlements depend on bank NEFT/IMPS clearing windows and nodal account funding.
- **No "AI-Powered Matching":** Shift discovery is deterministic, query-driven, and based on locality, availability, and declared skills.
- **No "Aadhaar Biometric Liveness":** Current verification is document-photo inspection by human admin reviewers.
- **No "Masked Virtual Calling":** Phone links use standard device `tel:` protocol connecting directly to authorized supervisor numbers.
