# Opskl Native App Store Release Playbook

This playbook outlines the official end-to-end production distribution strategy for the **Opskl Worker** (`apps/worker`) and **Opskl Organizer** (`apps/organizer`) native mobile applications on the **Apple App Store** and **Google Play Console**.

---

## 1. App Identities and Package Configuration

| Parameter | Opskl Worker App | Opskl Organizer App |
| :--- | :--- | :--- |
| **App Name (Store)** | Opskl: On-Demand Event Shifts | Opskl Organizer: Event Crew |
| **Internal Slug** | `opskil-worker` | `opskil-organizer` |
| **iOS Bundle Identifier** | `com.opskil.worker` | `com.opskil.organizer` |
| **Android Application ID** | `com.opskil.worker` | `com.opskil.organizer` |
| **Initial Version** | `1.0.0` | `1.0.0` |
| **Build Number / Version Code** | `1` | `1` |
| **Primary Category** | Business / Gig Economy | Business / Productivity |
| **Secondary Category** | Lifestyle / Events | Events & Entertainment |
| **Content / Age Rating** | 18+ (Employment & Gig Work) | 18+ (Business & Commercial) |
| **Custom URL Scheme** | `opskil-worker://` | `opskil-organizer://` |
| **Universal Links** | `https://opskil.com/worker`, `https://worker.opskil.com` | `https://opskil.com/organizer`, `https://organizer.opskil.com` |

---

## 2. Store Listings & Metadata

### 2.1 Opskl Worker Application

#### Subtitle (Apple App Store — max 30 chars)
> On-Demand Event Shifts & Work

#### Short Description (Google Play — max 80 chars)
> Find daily event crew shifts, swipe to apply, check in, and get paid directly.

#### Keywords (Apple App Store — max 100 chars)
> event jobs,gig work,event crew,part time shifts,hospitality jobs,ushering jobs,catering crew,daily wage

#### Full Description (App Store & Google Play)
```text
Opskl is India's premier transparent marketplace connecting skilled event crew with verified event organizers, production houses, and banquet managers.

WHETHER YOU ARE A STUDENT, FREELANCER, OR EXPERIENCED EVENT PROFESSIONAL:
• Instant Discovery: Browse premium event shifts in Mumbai, Delhi NCR, Bengaluru, and beyond.
• Swipe to Apply: Swipe right to apply for VIP ushering, registration desk, backstage management, catering supervision, and setup crew.
• Transparent Pay: Every shift explicitly displays daily earnings in INR, shift timings, meal inclusions, transport allowances, and dress codes.
• Zero Hidden Commissions: 100% of your agreed daily wage is paid directly into your verified bank account or UPI ID.
• Frictionless Check-in: GPS-verified geofencing and secure QR/PIN check-in at the event venue.
• Built-in Worker Protection: Automated grievance reporting and verified attendance logging protect your earnings.

Requirements:
• 18 years or older
• Valid Government Identity Proof (Aadhaar / Voter ID / Driving License)
• Active UPI ID or Indian Bank Account for direct wage payouts
```

---

### 2.2 Opskl Organizer Application

#### Subtitle (Apple App Store — max 30 chars)
> Hire & Manage Event Staff

#### Short Description (Google Play — max 80 chars)
> Post event shifts, hire verified crew, track live attendance, and disburse wages.

#### Keywords (Apple App Store — max 100 chars)
> event staffing,crew hire,event managers,temp staff,hospitality hiring,usher hiring,event production

#### Full Description (App Store & Google Play)
```text
Opskl Organizer gives event managers, wedding planners, and exhibition organizers an enterprise-grade crew management console on mobile.

STAFF YOUR NEXT EVENT IN MINUTES:
• 11-Step Shift Publishing: Publish multi-day event shifts with granular responsibilities, skill requirements, reporting instructions, meal terms, and transport rules.
• Pre-Screened Talent: Browse verified applicant profiles with government KYC badges, language proficiencies, and authentic peer ratings.
• Real-time Live Roster: Monitor worker confirmations, real-time arrival statuses, and venue geofence check-ins from a single live dashboard.
• Automated Venue Check-in: Generate secure, rotating 4-digit venue attendance codes and QR passes to eliminate buddy-punching and ghost staffing.
• Compliant Escrow Billing: Secure pre-funded escrow wallet with transparent GST billing (SAC 998519), automatic invoices, and instant one-tap batch payouts.
• Operational Reliability: Real-time candidate replacement queues and dispute escalation to the Opskl Trust Operations desk.

Built for event production companies, exhibition organizers, luxury caterers, and live concerts.
```

---

## 3. URLs, Privacy Policy & Compliance Declarations

| Document | Public Live URL | Dedicated Contact |
| :--- | :--- | :--- |
| **Privacy Policy** | `https://opskil.com/privacy` | `privacy@opskil.com` |
| **Terms of Service** | `https://opskil.com/terms` | `legal@opskil.com` |
| **Customer Support Desk** | `https://opskil.com/support` | `support@opskil.com` |
| **Enterprise Desk** | `https://opskil.com/enterprise` | `enterprise@opskil.com` |
| **Grievance Officer (IT Act)** | `https://opskil.com/grievance` | `grievance@opskil.com` |

---

## 4. Native Permissions & Purpose Specifications

Opskl follows strict data minimization principles. **No background location is requested or declared.**

### 4.1 iOS Info.plist Declarations
```xml
<!-- Encryption Export Compliance -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<!-- Location (Foreground only for venue distance and check-in proximity) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Opskl requires location access while using the app to calculate distance to event venues and verify proximity during on-site shift check-in.</string>

<!-- Camera (Attendance QR scanning and identity document capture) -->
<key>NSCameraUsageDescription</key>
<string>Opskl uses your camera to scan shift attendance QR codes and capture identity verification documents.</string>

<!-- Photo Library (Profile pictures and certificate attachments) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Opskl accesses your photo library to allow uploading profile photos and verification certificates.</string>

<!-- Push Notifications -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

### 4.2 Android Manifest Permissions
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />
```

---

## 5. Apple Privacy Nutrition Labels & Google Play Data Safety

### 5.1 Apple Privacy Nutrition Labels

| Data Category | Data Type | Linked to Identity? | Used for Tracking? | Stated Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Contact Info** | Name, Phone Number, Email | Yes | No | Account creation, booking notifications, emergency contact |
| **Location** | Precise & Coarse Location (when app is active) | Yes | No | Distance to venue, attendance check-in verification |
| **Financial Info** | Bank account / UPI VPA (Worker only) | Yes | No | Direct wage disbursement & tax compliance |
| **User Content** | Photos (Profile & Documents) | Yes | No | KYC identity verification, event credentials |
| **Identifiers** | User ID, Device ID | Yes | No | Session restoration, push notifications, fraud detection |
| **Usage Data** | App interactions, swipe actions | Yes | No | Job recommendation relevance & quality assurance |

### 5.2 Google Play Data Safety Declarations
- **Data Encryption in Transit**: All communications use TLS 1.3 encryption.
- **Data Encryption at Rest**: Encrypted using AES-256 in Supabase PostgreSQL and private AWS S3 buckets.
- **Account Deletion Mechanism (Apple Guideline 5.1.1(v) & Google Play)**:
  - Users can initiate instantaneous account deletion directly from the Profile tab in both apps.
  - Personal data, KYC files, and location logs are automatically scheduled for permanent purging within 30 days.
  - Deletion request web portal available at `https://opskil.com/account/delete`.

---

## 6. Reviewer Credentials (Safe Demo Mode)

To enable Apple App Review and Google Play Review teams to evaluate the full end-to-end functionality without exposing real customer PII or processing live monetary transactions:

### 6.1 Worker Review Account
- **Phone Number**: `+91 99999 00001`
- **SMS OTP**: `123456`
- **Pre-populated State**:
  - KYC Status: Verified (Aadhaar badge)
  - Pre-loaded upcoming shifts at Jio World Convention Centre, Mumbai
  - Pre-loaded earnings record with completed shifts and approved payments

### 6.2 Organizer Review Account
- **Phone Number**: `+91 99999 00002`
- **SMS OTP**: `123456`
- **Pre-populated State**:
  - Organization: Apex Event Productions (GST Verified)
  - Available Escrow Wallet Balance: ₹45,000 (Sandbox)
  - Active Shift: "Registration Desk & VIP Usher" with 4 applicants ready for review and check-in demo

### 6.3 Reviewer Instructions Note
> "Opskl is an enterprise marketplace for temporary event crew in India. The application uses OTP authentication via SMS. Reviewers can log in using the designated credentials above with OTP 123456. To test attendance check-in, use sample 4-digit code OP-4829 or click 'Confirm Check-in' on the mock shift screen."

---

## 7. EAS Build Profiles & Signing Pipeline

Both `apps/worker/eas.json` and `apps/organizer/eas.json` are configured for automated cloud builds and submission:

### 7.1 EAS Build Commands

#### Development Build (for internal team testing):
```bash
# Worker
cd apps/worker && eas build --profile development --platform all

# Organizer
cd apps/organizer && eas build --profile development --platform all
```

#### Preview Build (Internal Ad-Hoc / TestFlight internal):
```bash
# Worker
cd apps/worker && eas build --profile preview --platform all

# Organizer
cd apps/organizer && eas build --profile preview --platform all
```

#### Production Build (AAB for Google Play, App Store package for iOS):
```bash
# Worker
cd apps/worker && eas build --profile production --platform all

# Organizer
cd apps/organizer && eas build --profile production --platform all
```

### 7.2 Automated Store Submission
```bash
# Submit Worker to App Store Connect and Google Play Internal Track
cd apps/worker && eas submit --platform all --profile production

# Submit Organizer to App Store Connect and Google Play Internal Track
cd apps/organizer && eas submit --platform all --profile production
```

---

## 8. Release Staged Rollout & Post-Launch Monitoring

### 8.1 Google Play Phased Rollout Schedule
1. **Day 1**: 1% (Internal smoke-test & automated crash filter)
2. **Day 2**: 2%
3. **Day 3**: 5%
4. **Day 4**: 10%
5. **Day 5**: 20%
6. **Day 6**: 50%
7. **Day 7**: 100% (Full public availability)

### 8.2 Apple App Store Phased Release
Enable the native **7-day phased release** in App Store Connect. If any issue occurs, the rollout can be paused at any time for up to 30 days.

### 8.3 Critical Incident Thresholds & Rollback Trigger
- **Crash-free Sessions < 99.5%**: Immediately pause phased rollout.
- **Critical Auth / Check-in Failure Rate > 1%**: Engage backend feature flag `MAINTENANCE_MODE_ACTIVE=true` to alert users and halt app traffic.
- **Rollback Procedure**: Revert to previous validated binary version or push emergency OTA update via Expo EAS Update for JavaScript-layer fixes.
