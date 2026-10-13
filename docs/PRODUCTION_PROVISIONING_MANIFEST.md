# Opskl Production Provisioning Manifest & Credentials Checklist
**Version:** 1.0.0 · **Target Release:** Opskl Production Deployment & App Store Release · **Date:** October 2026

This document lists everything required from you to connect the live backend, configure payments, enable production SMS OTP, register push notifications, and trigger automated builds for the Apple App Store and Google Play Store.

---

## 1. Quick Action Checklist

| Category | Item | Priority | How to Provide |
| :--- | :--- | :--- | :--- |
| **Database** | Live Supabase Project & Direct Postgres URL | **P0 (Blocker)** | Provide in `.env.production` or secure vault |
| **Authentication** | SMS Provider Credentials & TRAI DLT Headers | **P0 (Blocker)** | Configure in Supabase Auth or provide keys |
| **Payments** | Payment Gateway API Keys & Webhook Secret | **P0 (Blocker)** | Provide Razorpay/Cashfree Keys |
| **Apple iOS** | Apple Team ID & App Store Connect API Key | **P1 (Store)** | Provide Team ID, Issuer ID, Key ID, `.p8` |
| **Google Android** | Google Play Service Account JSON | **P1 (Store)** | Provide Service Account JSON & FCM key |
| **Expo / Builds** | Expo EAS Token & Project Access | **P1 (Store)** | Provide `EXPO_TOKEN` |
| **Legal / URLs** | Privacy Policy & Terms of Service URLs | **P1 (Store)** | Hosted URLs or allow us to generate them |

---

## 2. Detailed Technical Requirements

### Category A: Supabase Production Environment (Database & Auth)
We need a clean, production Supabase project (or self-hosted Postgres) to deploy the migrations (`20261012000000` through `20261012000006`), establish RLS policies, and run security-definer RPCs.

1. **`EXPO_PUBLIC_SUPABASE_URL`**
   - Format: `https://[your-project-ref].supabase.co`
   - Purpose: Public API gateway used by Worker, Organizer, and Admin apps.
2. **`EXPO_PUBLIC_SUPABASE_ANON_KEY`**
   - Format: `eyJhbGciOi...`
   - Purpose: Public JWT anon key embedded in client mobile and web apps.
3. **`SUPABASE_SERVICE_ROLE_KEY`** (Confidential)
   - Format: `eyJhbGciOi...`
   - Purpose: Privileged server key for automated CI integration tests, webhooks, and administrative actions.
4. **`DATABASE_URL`** (Direct PostgreSQL Connection String)
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
   - Purpose: Required to execute the sequential SQL migrations and run adversarial schema tests.

---

### Category B: Indian SMS & OTP Provider (TRAI DLT Compliance)
Opskl uses phone-number-based OTP authentication for gig workers and organizers. Under TRAI regulations in India, SMS gateways require DLT (Distributed Ledger Technology) registration.

1. **SMS Gateway Provider Choice**:
   - Supported: **Twilio**, **MessageBird**, **Msg91**, or **Fast2SMS**.
   - What we need: Provider Account SID/Auth Token or API Key.
2. **TRAI DLT Parameters**:
   - **DLT Entity / Principal Entity (PE) ID**: (e.g., `1101xxxxxxxxxxxx`)
   - **Sender Header**: (6-character alpha header, e.g., `OPSKIL`)
   - **DLT Registered Template ID**: (e.g., `1107xxxxxxxxxxxx`)
   - **Registered Message Content Pattern**:
     > *"Your Opskl verification OTP is {#var#}. Valid for 10 minutes. Do not share this code with anyone. - OPSKIL"*
3. **App Store Review Bypass / Static Fixture Number**:
   - Apple and Google app reviewers must be able to log in without receiving an Indian SMS.
   - Designate 2 test phone numbers (e.g., `9820098200` for Worker, `9819998199` for Organizer) with fixed test OTP `123456` configured in Supabase Auth -> Providers -> Phone -> Test phone numbers.

---

### Category C: Indian Payments & Payouts Gateway
Opskl requires two-sided payment processing: **Escrow collection** from event organizers and **Direct UPI payout settlement** to event workers.

1. **Payment Gateway Provider**:
   - Recommended: **Razorpay** (with Razorpay Route & RazorpayX Payouts) or **Cashfree Payments** (Payouts & AutoCollect).
2. **API Credentials**:
   - **`PAYMENT_GATEWAY_KEY_ID`**: (e.g., `rzp_live_...` or `rzp_test_...`)
   - **`PAYMENT_GATEWAY_KEY_SECRET`**: (Confidential API secret)
   - **`PAYMENT_GATEWAY_WEBHOOK_SECRET`**: (Secret used to verify HMAC-SHA256 signatures on payment status webhooks)
3. **Business Compliance & GST Details**:
   - **Legal Business Name**: (e.g., `Opskl Technologies Private Limited`)
   - **GSTIN**: (15-character Indian GST registration number, e.g., `27AAAAA0000A1Z5` for Maharashtra)
   - **Registered Office Address**: (Printed on automated GST tax invoices for organizers)
   - **Standard Platform Fee Rate**: (Default is 10% + 18% GST on platform service fee, SAC code `998519`)

---

### Category D: Apple App Store & iOS Distribution
To build native binaries, distribute via TestFlight, and release to the App Store:

1. **Apple Developer Account Details**:
   - **Apple Developer Account Type**: Organization / Company account (recommended for marketplace apps)
   - **Apple Team ID**: 10-character alphanumeric ID (found under Apple Developer Membership)
2. **App Store Connect API Key** (For automated EAS / CI builds):
   - **Issuer ID**: UUID from App Store Connect -> Users and Access -> Integrations
   - **Key ID**: 10-character key ID
   - **Private Key File (`.p8`)**: Downloaded from App Store Connect (e.g., `AuthKey_ABCD1234EF.p8`)
3. **Apple Push Notification Service (APNs)**:
   - APNs Key (`.p8`) with Push Notifications enabled.
   - Key ID & Team ID.
4. **Bundle Identifiers**:
   - Worker App: `com.opskil.worker`
   - Organizer App: `com.opskil.organizer`

---

### Category E: Google Play Store & Android Distribution
To build Android App Bundles (`.aab`) and distribute via Internal Testing / Production tracks:

1. **Google Play Console Account**:
   - Access to Google Play Console.
2. **Google Play Service Account JSON Key**:
   - Created in Google Cloud Console with Google Play Android Developer API enabled.
   - Role: Releases manager on Google Play Console.
3. **Firebase Cloud Messaging (FCM)**:
   - `google-services.json` file for Android push notifications.
   - Firebase Project Server Key or Service Account credentials.
4. **Package Names**:
   - Worker App: `com.opskil.worker`
   - Organizer App: `com.opskil.organizer`

---

### Category F: Expo Application Services (EAS) & GitHub CI
1. **Expo EAS Account**:
   - **EAS Username / Organization slug**.
   - **`EXPO_TOKEN`**: Personal Access Token from `expo.dev/settings/access-tokens` (used to build and sign iOS/Android binaries in the cloud).
2. **GitHub Repository Configuration**:
   - Repository: `Coderaryanyadav/OpsklTest`
   - Permissions to add Repository Secrets for automated CI checks (`npm run typecheck`, `npm test`, DB migration validation).

---

### Category G: Web Hosting, Domains & Legal Assets
Apple and Google require live web assets before approving marketplace apps:

1. **Domains & Hostnames**:
   - Primary domain: (e.g., `opskil.com`)
   - Admin Web Console URL: (e.g., `https://admin.opskil.com` or Vercel deployment URL)
2. **Public Legal URLs** (Mandatory for Store Review):
   - **Privacy Policy URL**: (e.g., `https://opskil.com/privacy`)
   - **Terms of Service URL**: (e.g., `https://opskil.com/terms`)
   - **Account Deletion Instructions URL**: (e.g., `https://opskil.com/delete-account` — required by Apple Guideline 5.1.1(v))
   - **Support / Contact Email**: (e.g., `support@opskil.com`)
3. **Universal Links & App Links**:
   - Hosting for `.well-known/apple-app-site-association` and `.well-known/assetlinks.json` on your primary domain.

---

## 3. Production Environment File Template

When ready, you can create a `.env.production` file in the project root based on this template:

```bash
# ==============================================================================
# OPSKL PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================

# --- SUPABASE PRODUCTION CREDENTIALS ---
EXPO_PUBLIC_SUPABASE_URL="https://[YOUR_PROD_PROJECT].supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="[YOUR_PROD_ANON_KEY]"
EXPO_PUBLIC_APP_ENV="production"
EXPO_PUBLIC_USE_DEMO_FIXTURES="false"
EXPO_PUBLIC_DEFAULT_CITY="Mumbai"
EXPO_PUBLIC_DEFAULT_TIMEZONE="Asia/Kolkata"

# --- SERVER-ONLY SECRETS ---
SUPABASE_SERVICE_ROLE_KEY="[YOUR_PROD_SERVICE_ROLE_KEY]"
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# --- PAYMENT GATEWAY (RAZORPAY / CASHFREE) ---
PAYMENT_GATEWAY_MODE="live"
RAZORPAY_KEY_ID="rzp_live_[KEY_ID]"
RAZORPAY_KEY_SECRET="[SECRET]"
RAZORPAY_WEBHOOK_SECRET="[WEBHOOK_SECRET]"

# --- ADMIN DASHBOARD ---
NEXT_PUBLIC_APP_URL="https://admin.opskil.com"
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR_PROD_PROJECT].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR_PROD_ANON_KEY]"
NEXT_PUBLIC_APP_ENV="production"

# --- EXPO EAS BUILD TOKEN ---
EXPO_TOKEN="[YOUR_EXPO_CLI_TOKEN]"
```

---

## 4. How You Can Share This Information

You can provide the details in whichever manner you prefer:

1. **Fill out the `.env.production` file** directly on your machine.
2. **Provide the keys / credentials directly in this chat** (all sensitive tokens are strictly kept locally in your workspace).
3. **Provide them section by section** (e.g., start with Supabase credentials so we can verify clean migrations first, then payment gateway, then App Store keys).
