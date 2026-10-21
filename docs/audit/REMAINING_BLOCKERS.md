# Opskl Remaining Launch Blockers (External Credentials & Human Decisions)

**Document Date:** October 22, 2026  
**Status:** Software implementation is verified. The following 5 items are external operational and legal prerequisites that must be satisfied by authorized operators before moving from **Conditional Pilot / Controlled Sandbox** to an **Unrestricted Live Public Launch with Real Money**.

---

### 1. Razorpay Escrow / Route Production Merchant Account
- **Category:** Financial Provider & Compliance
- **Description:** Opskl currently operates in **Manual Escrow Pilot SOP** mode (organizers submit bank transfer UTR references which admins verify). For automated real-money bank escrow, the production Razorpay Route / Smart Collect merchant account must be KYC-verified by Razorpay and linked.
- **Required Action:**
  1. Complete Razorpay corporate KYC and activate Route / Node Escrow feature.
  2. Populate `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in production Supabase Vault / Edge Functions environment.
  3. Verify bank transfer webhook endpoints against live Razorpay sandbox.

---

### 2. Production SMS / SMTP Gateway Credentials
- **Category:** Authentication & Communications Provider
- **Description:** Current email and SMS authentication relies on Supabase Auth's default SMTP sandbox (subject to strict rate limits: ~3 emails/hour).
- **Required Action:**
  1. Configure custom production SMTP in Supabase dashboard (SendGrid, Postmark, AWS SES, or Resend).
  2. Configure production SMS OTP provider (Twilio or MSG91) in Supabase Auth to enable SMS OTP for workers without email.
  3. Set `TEST_LIVE_OTP=false` in production deployment.

---

### 3. Apple APNs & Google FCM Push Credentials in Expo EAS
- **Category:** Mobile Infrastructure
- **Description:** Real physical device notifications require registered APNs auth keys (.p8) and Firebase Cloud Messaging server credentials configured in Expo Application Services (EAS).
- **Required Action:**
  1. Upload Apple APNs Key (`.p8`) to Expo EAS Dashboard under the iOS project identifier (`com.opskil.worker`, `com.opskil.organizer`).
  2. Upload `google-services.json` / FCM server credentials for Android.
  3. Set `EXPO_ACCESS_TOKEN` in Supabase Edge Functions environment.

---

### 4. Apple Developer & Google Play Console Store Accounts
- **Category:** Store Distribution
- **Description:** The apps are configured with EAS build configurations (`eas.json`) targeting internal distribution and store releases.
- **Required Action:**
  1. Link Apple Developer Team ID (`DEVELOPMENT_TEAM`) in `apps/worker/app.json` and `apps/organizer/app.json`.
  2. Configure signing certificates via `eas build --profile production`.
  3. Submit to TestFlight / Google Play Internal Testing for closed pilot feedback.

---

### 5. On-Site Physical GPS & Hardware Testing
- **Category:** Operational Validation
- **Description:** Geofenced check-in (300m Haversine) and dual-PIN entry have been mathematically and transactionally verified in code and unit tests. Physical on-site testing under real cellular/satellite conditions is required before live event deployment.
- **Required Action:**
  1. Conduct a physical dry run at an actual venue (e.g. Jio World Convention Centre, BKC, Mumbai).
  2. Confirm device GPS accuracy (`expo-location` accuracy threshold ~30m).
  3. Verify offline queue sync on ground when cellular reception drops.
