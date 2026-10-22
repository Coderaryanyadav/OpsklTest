import { ALL_MUMBAI_ZONE, MUMBAI_ZONES } from '../src/utils/location';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3 Worker App Invariants & Launch Fixes', () => {
  const workerAppDir = path.resolve(__dirname, '..');

  test('3.1 Location zones include ALL_MUMBAI_ZONE at index 0', () => {
    expect(MUMBAI_ZONES[0]).toEqual(ALL_MUMBAI_ZONE);
    expect(ALL_MUMBAI_ZONE.id).toBe('all');
    expect(ALL_MUMBAI_ZONE.label).toBe('All Mumbai Zones');
    expect(MUMBAI_ZONES.length).toBeGreaterThan(5);
  });

  test('3.2 Worker dependencies include expo-location, lucide-react-native, and react-native-svg', () => {
    const pkgJsonPath = path.join(workerAppDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    expect(pkg.dependencies['expo-location']).toBeDefined();
    expect(pkg.dependencies['lucide-react-native']).toBeDefined();
    expect(pkg.dependencies['react-native-svg']).toBeDefined();
  });

  test('3.3 Worker _layout.tsx implements AuthProvider with expectedRole="worker" and role mismatch screen', () => {
    const layoutPath = path.join(workerAppDir, 'app/_layout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');
    expect(content).toContain('expectedRole="worker"');
    expect(content).toContain('roleMismatch');
    expect(content).toContain('isDeactivated');
    expect(content).toContain('SplashScreen.hideAsync()');
  });

  test('3.4 Worker onboarding.tsx implements KYC document verification and terms agreement', () => {
    const onboardingPath = path.join(workerAppDir, 'app/onboarding.tsx');
    const content = fs.readFileSync(onboardingPath, 'utf8');
    expect(content).toContain('submitVerificationCaseSafe');
    expect(content).toContain('agreedToTerms');
    expect(content).toContain('Aadhaar Card');
    expect(content).toContain('PAN Card');
  });

  test('3.5 Worker my-shifts.tsx implements GPS check-in via expo-location and excludes past shifts from active', () => {
    const myShiftsPath = path.join(workerAppDir, 'app/(tabs)/my-shifts.tsx');
    const content = fs.readFileSync(myShiftsPath, 'utf8');
    expect(content).toContain("import * as Location from 'expo-location'");
    expect(content).toContain('Location.requestForegroundPermissionsAsync()');
    expect(content).toContain('Location.getCurrentPositionAsync');
    expect(content).toContain('checkInWorkerSafe');
    expect(content).toContain('VENUE_COORDINATES_MISSING');
    expect(content).toContain('OUTSIDE_CHECKIN_WINDOW');
    expect(content).toContain('OUT_OF_GEOFENCE_RANGE');
    // Ensure past confirmed shifts are categorized into cancelled/past rather than active
    expect(content).toContain("b.status === 'confirmed' && (b.job?.date || '') === todayStr");
    expect(content).toContain("b.status === 'confirmed' && (b.job?.date || '') < todayStr");
  });

  test('3.6 Worker discovery feed decouples appliedJobIds from loadFeed dependency array', () => {
    const feedHookPath = path.join(workerAppDir, 'src/hooks/useDiscoveryFeed.ts');
    const content = fs.readFileSync(feedHookPath, 'utf8');
    expect(content).toContain('appliedJobIdsRef');
    // Must not contain appliedJobIds in the loadFeed useCallback deps
    expect(content).not.toMatch(/loadFeed\s*=\s*useCallback\([\s\S]*?\[workerId,\s*filters,\s*appliedJobIds\]/);
  });

  test('3.7 Worker profile dynamically reflects verification status and avoids fake phone claim', () => {
    const profilePath = path.join(workerAppDir, 'app/(tabs)/profile.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');
    expect(content).not.toContain("'Phone verified'");
    expect(content).toContain('Verified Worker');
    expect(content).toContain('Pending Verification');
    expect(content).toContain('Verification Rejected');
    expect(content).toContain('requestAccountDeletionSafe');
  });

  test('3.8 Unbacked marketing claims purged from worker onboarding, welcome, and earnings', () => {
    const welcomeContent = fs.readFileSync(path.join(workerAppDir, 'app/welcome.tsx'), 'utf8');
    expect(welcomeContent).not.toContain('Escrow-Protected Payouts');

    const earningsContent = fs.readFileSync(path.join(workerAppDir, 'app/(tabs)/earnings.tsx'), 'utf8');
    expect(earningsContent).not.toContain('100% WAGE GUARANTEE');
  });

  test('3.9 Shared Design System enforces obsidian monochrome, precision blue, and operational tokens', () => {
    const dsDir = path.resolve(workerAppDir, '../../packages/design-system/src');
    const colorsContent = fs.readFileSync(path.join(dsDir, 'tokens/colors.ts'), 'utf8');
    expect(colorsContent).toContain("primary: '#0F1115'");
    expect(colorsContent).toContain("accent: '#0F52BA'");
    expect(colorsContent).toContain('operationalDraft:');
    expect(colorsContent).toContain('operationalApplied:');
    expect(colorsContent).toContain('operationalSelected:');
    expect(colorsContent).toContain('operationalCheckedIn:');
    expect(colorsContent).toContain('operationalDisputed:');
    expect(colorsContent).toContain('operationalPaid:');
  });

  test('3.10 Shared Design System typography defines display scale and tabular numeric data token', () => {
    const dsDir = path.resolve(workerAppDir, '../../packages/design-system/src');
    const typoContent = fs.readFileSync(path.join(dsDir, 'tokens/typography.ts'), 'utf8');
    expect(typoContent).toContain('displayLg:');
    expect(typoContent).toContain('headlineLg:');
    expect(typoContent).toContain('numericData:');
    expect(typoContent).toContain("'tabular-nums'");
  });

  test('3.11 Shared Design System spacing exposes hairline borders and 4-layer elevation system', () => {
    const dsDir = path.resolve(workerAppDir, '../../packages/design-system/src');
    const spacingContent = fs.readFileSync(path.join(dsDir, 'tokens/spacing.ts'), 'utf8');
    expect(spacingContent).toContain('hairline: 1');
    expect(spacingContent).toContain('elevationLayers = {');
    expect(spacingContent).toContain('layer0:');
    expect(spacingContent).toContain('layer1:');
    expect(spacingContent).toContain('layer2:');
    expect(spacingContent).toContain('layer3:');
  });

  test('3.12 Shared Design System components implement operational variants and accessible touch targets', () => {
    const dsDir = path.resolve(workerAppDir, '../../packages/design-system/src');
    const badgeContent = fs.readFileSync(path.join(dsDir, 'components/Badge.tsx'), 'utf8');
    expect(badgeContent).toContain("'draft'");
    expect(badgeContent).toContain("'applied'");
    expect(badgeContent).toContain("'selected'");
    expect(badgeContent).toContain("'checked_in'");
    expect(badgeContent).toContain("'disputed'");
    expect(badgeContent).toContain("'paid'");

    const buttonContent = fs.readFileSync(path.join(dsDir, 'components/Button.tsx'), 'utf8');
    expect(buttonContent).toContain("'accent'");
    expect(buttonContent).toContain("size === 'sm' ? 44 :");

    const tabBarContent = fs.readFileSync(path.join(dsDir, 'components/BottomTabBar.tsx'), 'utf8');
    expect(tabBarContent).toContain('useSafeAreaInsets');
  });

  test('3.13 Worker Welcome screen implements Stitch value props, active hubs, and 1,400+ shifts metric', () => {
    const welcomePath = path.join(workerAppDir, 'app/welcome.tsx');
    const content = fs.readFileSync(welcomePath, 'utf8');
    expect(content).toContain('Single-Day & Event Staffing in Mumbai');
    expect(content).toContain('Active Hubs: BKC • NESCO • South Mumbai');
    expect(content).toContain('Transparent Shift Pay');
    expect(content).toContain('Verified Event Venues');
    expect(content).toContain('Structured Check-In');
    expect(content).toContain('1,400+ Shifts Disbursed');
    expect(content).toContain('Get Started with Phone Number');
    expect(content).toContain('Existing Worker? Sign In');
    expect(content).toContain('Aadhaar/PAN KYC verification are mandatory');
  });

  test('3.14 Worker Phone & OTP screen implements countdown timer, masked phone, and security advisory', () => {
    const loginPath = path.join(workerAppDir, 'app/auth/login.tsx');
    const content = fs.readFileSync(loginPath, 'utf8');
    expect(content).toContain('SECURE ACCESS • MUMBAI WORKFORCE');
    expect(content).toContain('Enter verification code');
    expect(content).toContain('getMaskedPhone');
    expect(content).toContain('Edit number');
    expect(content).toContain('Resend code in');
    expect(content).toContain('Resend SMS');
    expect(content).toContain('WhatsApp OTP (not available)');
    expect(content).not.toContain('Verification dispatch triggered via WhatsApp');
    expect(content).toContain('Never share your OTP with event organizers');
    expect(content).toContain('sendPhoneOtp');
  });

  test('3.15 Worker Onboarding Step 1 implements work preferences, locality dispatch base, and skills setup', () => {
    const onboardingPath = path.join(workerAppDir, 'app/onboarding.tsx');
    const content = fs.readFileSync(onboardingPath, 'utf8');
    expect(content).toContain('STEP 1 OF 2 • PROFILE SETUP');
    expect(content).toContain('Tell us about your work preference');
    expect(content).toContain('IST DISPATCH BASE');
    expect(content).toContain('Bandra Kurla Complex (BKC)');
    expect(content).toContain('Weekend Surge Shifts');
    expect(content).toContain('Select at least 2 roles');
    expect(content).toContain('Average Daily Gig Rate: ₹1,800 – ₹2,400');
    expect(content).toContain('Continue to KYC Verification');
  });

  test('3.16 Worker Onboarding Step 2 implements masked KYC, real status banners, and encrypted upload slots', () => {
    const onboardingPath = path.join(workerAppDir, 'app/onboarding.tsx');
    const content = fs.readFileSync(onboardingPath, 'utf8');
    expect(content).toContain('STEP 2 OF 2 • COMPLIANCE');
    expect(content).toContain('MASKED KYC');
    expect(content).toContain('Identity Verification (KYC)');
    expect(content).toContain('KYC Verification Pending Review');
    expect(content).toContain('KYC Verified & Active');
    expect(content).toContain('Re-Submission Required');
    expect(content).toContain('getDisplayMaskedDoc');
    expect(content).toContain('watermarkLock');
    expect(content).toContain('UPI ON FILE');
    expect(content).toContain('Attach Document');
  });

  test('3.17 Worker Discover Feed implements Stitch visual hierarchy, live cards count, and truthful empty states', () => {
    const indexPath = path.join(workerAppDir, 'app/(tabs)/index.tsx');
    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toContain('Search by venue, role or organizer...');
    expect(content).toContain('KYC UNDER REVIEW');
    expect(content).toContain('Case ···');
    expect(content).toContain('Verification status: pending admin review (no OCR engine connected)');
    expect(content).toContain('All Venues');
    expect(content).toContain('₹2,000+ / shift');
    expect(content).toContain('BKC (Jio World)');
    expect(content).toContain('NESCO Goregaon');
    expect(content).toContain('Hospitality');
    expect(content).toContain('displayedCards.length} LIVE');
    expect(content).toContain('OPEN •');
    expect(content).toContain('SLOTS LEFT');
    expect(content).toContain('Wage shown');
    expect(content).not.toContain('Instant UPI');
    expect(content).not.toContain('KYC-BOM-9102');
    expect(content).toContain('APPLICATION SUBMITTED • UNDER REVIEW');
    expect(content).toContain('No Shifts Match Current Filters');
    expect(content).toContain('Clear Restrictive Filters');
    expect(content).toContain('Try Nearby Localities');
  });

  test('3.18 Worker Multi-Filter Sheet implements Stitch discover_search_multi_filters specifications', () => {
    const filterPath = path.join(workerAppDir, 'src/components/FilterSheet.tsx');
    const content = fs.readFileSync(filterPath, 'utf8');
    expect(content).toContain('Wage Basis & Minimum Pay');
    expect(content).toContain('Per Shift (₹)');
    expect(content).toContain('Per Hour (₹/hr)');
    expect(content).toContain('Listed wage floor');
    expect(content).toContain('Target Minimum Wage');
    expect(content).toContain('Mumbai Locality / Cluster');
    expect(content).toContain('BKC Complex');
    expect(content).toContain('NESCO / Goregaon E');
    expect(content).toContain('Role Specialization');
    expect(content).toContain('Guest Relations & Hospitality');
    expect(content).toContain('Registration & Badge Desk');
    expect(content).toContain('Shift Timing & Schedule');
    expect(content).toContain('Target Day');
    expect(content).toContain('Time Slot');
    expect(content).toContain('F&B Provided');
    expect(content).toContain('Ledger payout track');
    expect(content).toContain('Not a live UPI rail');
    expect(content).not.toContain('Instant Payout');
    expect(content).not.toContain('Guaranteed Base');
    expect(content).toContain('Apply Filters');
    expect(content).toContain('Reset All');
  });

  test('3.19 Worker Shift Details Briefing implements comprehensive briefing and truthful compensation', () => {
    const shiftDetailPath = path.join(workerAppDir, 'app/shift/[id].tsx');
    const content = fs.readFileSync(shiftDetailPath, 'utf8');
    expect(content).toContain('Slots Open • Verified Roster');
    expect(content).toContain('Net Shift Compensation');
    expect(content).toContain('Ledger settlement');
    expect(content).not.toContain('Direct UPI / NEFT');
    expect(content).toContain('Zero Deductions');
    expect(content).toContain('Schedule & Reporting');
    expect(content).toContain('IST Timings');
    expect(content).toContain('Duties & Core Responsibilities');
    expect(content).toContain('Mandatory Criteria & Attire');
    expect(content).toContain('Dress Code:');
    expect(content).toContain('ID Verification');
    expect(content).toContain('Attendance & Reliability Policy');
    expect(content).toContain('Review takes ~2-4 hours • Does not guarantee hiring');
    expect(content).toContain('ApplicationReviewModal');
  });

  test('3.20 Worker Application Review Modal enforces truthful lifecycle rules and double-tap prevention', () => {
    const reviewPath = path.join(workerAppDir, 'src/components/ApplicationReviewModal.tsx');
    const content = fs.readFileSync(reviewPath, 'utf8');
    expect(content).toContain('Step 2 of 2 • Review & Dispatch');
    expect(content).toContain('GIG ROSTER');
    expect(content).toContain('Verification & Profile Checklist');
    expect(content).toContain('Profile & Contact Details');
    expect(content).toContain('Preferred Locality Match');
    expect(content).toContain('Language Competency');
    expect(content).toContain('KYC Documentation');
    expect(content).toContain('Truthful Application Terms');
    expect(content).toContain('Applying does NOT confirm booking or guarantee wages');
    expect(content).toContain('I confirm availability for the full');
    expect(content).toContain('Transmit Application');
    expect(content).toContain('APPLICATION SUBMITTED • PENDING REVIEW');
    expect(content).toContain('#APP-BOM-');
    expect(content).toContain('Delivered to');
    expect(content).toContain('Step 1: Application Received & Logged');
    expect(content).toContain('Step 2: Roster Manager Screening Profile Fit');
    expect(content).toContain('Step 3: Offer Notification & Worker Confirmation');
    expect(content).toContain('Aadhaar Tokenized • Geofence Verified Hub');
  });

  test('3.21 My Shifts Dashboard (Screen 10) enforces distinct lifecycle states, urgent spot confirmation, and IST calendar sync', () => {
    const myShiftsPath = path.join(workerAppDir, 'app/(tabs)/my-shifts.tsx');
    const content = fs.readFileSync(myShiftsPath, 'utf8');

    // Header & Region
    expect(content).toContain('Mumbai Region');
    expect(content).toContain('My Shifts Dashboard');
    expect(content).toContain('Operational IST Roster');
    expect(content).toContain('Calendar Sync');
    expect(content).toContain('handleSyncCalendar');

    // Mandatory IST Protocol
    expect(content).toContain('Mandatory IST Protocol');
    expect(content).toContain('Strict Access');
    expect(content).toContain('Arrive at least 30 minutes before call time');

    // Tabs Rail
    expect(content).toContain("id: 'upcoming', label: 'Upcoming'");
    expect(content).toContain("id: 'needs_action', label: 'Needs Action'");
    expect(content).toContain("id: 'active', label: 'In Progress'");
    expect(content).toContain("id: 'completed', label: 'Past & Completed'");

    // Urgent Action Required (Expiry State) for selected_awaiting_confirmation
    expect(content).toContain('Action Required');
    expect(content).toContain('Expires in 02h 15m');
    expect(content).toContain('Confirmed Rate');
    expect(content).toContain('selected your profile from 38 contenders');
    expect(content).toContain('Confirmation is required immediately');
    expect(content).toContain('Decline Shift');
    expect(content).toContain('Confirm Spot');
    expect(content).toContain('handleConfirmSpot');
    expect(content).toContain('handleDeclineSpot');
    expect(content).toContain('workerConfirmSelectionSafe');
    expect(content).toContain('workerDeclineSelectionSafe');

    // Confirmed & Ready Card
    expect(content).toContain('Roster Locked • Gate Pass Issued');
    expect(content).toContain('Open Event Day Briefing');
    expect(content).toContain('Directions to Gate');
    expect(content).toContain('Pass Code (QR)');
    expect(content).toContain('Geofenced Check-in Unlocks');

    // Application Under Screening Card
    expect(content).toContain('Application Under Screening');
    expect(content).toContain('Organizer reviewing profiles for roster selection');
    expect(content).toContain('Unconfirmed');

    // Roster Guidelines & support (no fake BKC hotline)
    expect(content).toContain('Opskl Crew Guidelines');
    expect(content).toContain('Support: workforce@opskil.com');
    expect(content).toContain('Get Help');
    expect(content).not.toContain('+91 22 4910 8800');
    expect(content).toContain('GeofencedCheckInModal');
  });

  test('3.22 Confirmed Shift Detail & Day-Of Briefing (Screen 9) renders complete operational day-of briefing when booked', () => {
    const shiftDetailPath = path.join(workerAppDir, 'app/shift/[id].tsx');
    const content = fs.readFileSync(shiftDetailPath, 'utf8');

    // Header & Status
    expect(content).toContain('Confirmed Shift Detail & Day Of Briefing');
    expect(content).toContain('Confirmed Booking • Roster #04 Locked');
    expect(content).toContain('Ref: #');
    expect(content).toContain('IST GEOFENCE ON');

    // Time & Reporting Cardlet
    expect(content).toContain('Reporting Time: 09:30 AM IST Sharp');
    expect(content).toContain('calculateStartsIn');

    // Compensation (honest — attendance ≠ paid; no fake UPI rails)
    expect(content).toContain('Compensation Summary');
    expect(content).toContain('After attendance approval');
    expect(content).toContain('Ledger tracked');
    expect(content).toContain('Zero Deductions');
    expect(content).toContain('Single-shift cycle');
    expect(content).toContain('Disbursing to:');
    expect(content).not.toContain('aaravkulkarni@okhdfcbank');

    // Venue & Entry Protocol
    expect(content).toContain('Venue & Entry Protocol');
    expect(content).toContain('GATE 4 STAFF ENTRY');
    expect(content).toContain('Transit & Commute Advisory');
    expect(content).toContain('Bandra Kurla (Line 3 Aqua Line)');
    expect(content).toContain('Open in Google Maps / Citymapper');

    // Interactive Shift Readiness Protocol Checklist
    expect(content).toContain('Shift Readiness Protocol');
    expect(content).toContain('Western Formal Black Suit / Formal Sari');
    expect(content).toContain('Physical or Masked Aadhaar Card');
    expect(content).toContain('Opskl Geofence Check-in Token Ready');
    expect(content).toContain('completedChecklistCount');

    // On-Site Command
    expect(content).toContain('On-Site Command');
    expect(content).toContain('Phone on file');
    expect(content).toContain('Call Supervisor');
    expect(content).toContain('Emergency Desk');
    expect(content).not.toContain('Opskl Bridge Call');
    expect(content).not.toContain('Rohit Mehta');

    // Cancellation Policy & Bottom Action Bar
    expect(content).toContain('Cancellation Terms & Reliability Policy');
    expect(content).toContain('Free cancellation permitted up to 18 hours prior');
    expect(content).toContain('Proceed to Geofenced Check-In');
    expect(content).toContain('Request Coordinator Support');
    expect(content).toContain('GeofencedCheckInModal');
  });

  test('3.23 Geofenced Check-In enforces GPS verification and honest pass-code presentation (not fake scanner QR)', () => {
    const checkInModalPath = path.join(workerAppDir, 'src/components/GeofencedCheckInModal.tsx');
    const checkInRoutePath = path.join(workerAppDir, 'app/shift/checkin.tsx');
    const modalContent = fs.readFileSync(checkInModalPath, 'utf8');
    const routeContent = fs.readFileSync(checkInRoutePath, 'utf8');

    // Route existence
    expect(routeContent).toContain('ShiftCheckInScreen');
    expect(routeContent).toContain('GeofencedCheckInModal');

    // Modal Content & Semantics
    expect(modalContent).toContain('Geofenced Check-In & Token');
    expect(modalContent).toContain('LIVE SHIFT CHECK-IN');
    expect(modalContent).toContain('WITHIN GEOFENCE VERIFIED');
    expect(modalContent).toContain('OUT OF GEOFENCE RANGE');
    expect(modalContent).toContain('LOCATION PERMISSION REQUIRED');
    expect(modalContent).toContain('Location access is strictly required only at check-in');
    expect(modalContent).toContain('No background tracking is performed');

    // Honest pass-code presentation (decorative SVG is not a scannable protocol)
    expect(modalContent).toContain('Venue Pass Code');
    expect(modalContent).toContain('Show to supervisor');
    expect(modalContent).toContain('not a scannable protocol QR');
    expect(modalContent).toContain('displayToken');
    expect(modalContent).not.toContain('Dynamic IST Token');
    expect(modalContent).not.toContain('Screenshots Invalid');

    // 4 Checkpoints Milestone Tracker
    expect(modalContent).toContain('Operational Checkpoints');
    expect(modalContent).toContain('Geofence Perimeter Reached');
    expect(modalContent).toContain('Supervisor pass-code verification');
    expect(modalContent).toContain('Shift Active:');
    expect(modalContent).toContain('Geofenced Check-Out & Hours Sign-off');
    expect(modalContent).toContain('Hours recorded for supervisor review · not auto-paid');
    expect(modalContent).not.toContain('Instant disbursement validation upon close');

    // Fallbacks
    expect(modalContent).toContain('Scanner or Network Latency?');
    expect(modalContent).toContain('Manual Attendance PIN');
    expect(modalContent).toContain('manualPin');
    expect(modalContent).toContain('Call Lead Coordinator');
    expect(modalContent).toContain('Report Venue Access Issue / Dispute Location');
    expect(modalContent).toContain('checkInWorkerSafe');
    expect(modalContent).toContain('checkOutWorkerSafe');
  });

  test('3.24 Worker Earnings & Settlement Ledger (Screen 11) strictly separates 4-tier pipeline architecture and UTR records', () => {
    const earningsPath = path.join(workerAppDir, 'app/(tabs)/earnings.tsx');
    const content = fs.readFileSync(earningsPath, 'utf8');

    // Header & Cycle
    expect(content).toContain('Mumbai Region');
    expect(content).toContain('Worker Earnings & Settlement Ledger');
    expect(content).toContain('Settlement ledger · UPI rails not auto-wired');
    expect(content).toContain('Cycle:');

    // Primary Balance Card & Destination Tile (no fake HDFC / IMPS gateway)
    expect(content).toContain('Total Disbursed');
    expect(content).toContain('Payout Destination');
    expect(content).toContain('Ledger only · not live bank settlement');
    expect(content).toContain('Pending rails');
    expect(content).not.toContain('HDFC Bank (••• 4018)');
    expect(content).not.toContain('IMPS / UPI Automated Gateway');

    // 4-Tier Transparent Architecture Grid
    expect(content).toContain('Settlement Pipeline');
    expect(content).toContain('Non-negotiable state separation');
    expect(content).toContain('1. DISBURSED');
    expect(content).toContain('SETTLED');
    expect(content).toContain('Credited to Bank / UPI');
    expect(content).toContain('2. APPROVED');
    expect(content).toContain('BATCH TONIGHT');
    expect(content).toContain('Payout at 11:00 PM IST');
    expect(content).toContain('3. REVIEW');
    expect(content).toContain('AUDITING');
    expect(content).toContain('Supervisor signoff');
    expect(content).toContain('4. PROJECTED');
    expect(content).toContain('UPCOMING');
    expect(content).toContain('Rostered shifts');

    // Shift Ledger List & Truthful Settlement UTR
    expect(content).toContain('Shift Ledger');
    expect(content).toContain('SETTLED — MANUAL RECONCILIATION');
    expect(content).toContain('APPROVED • DISBURSAL SCHEDULED');
    expect(content).toContain('UNDER ATTENDANCE REVIEW');
    expect(content).toContain('Settlement ID:');
    expect(content).toContain('#SET-BOM-');
    expect(content).toContain('UTR:');

    // Statutory Compliance Banner & Action Links
    expect(content).toContain('Deductions & Statutory Compliance');
    expect(content).toContain('100% Payout');
    expect(content).toContain('Platform Deductions');
    expect(content).toContain('Zero worker charges');
    expect(content).toContain('TDS / Statutory Withholding');
    expect(content).toContain('Net Disbursed (1:1)');
    expect(content).toContain('Pay Statement Export (Unavailable)');
    expect(content).toContain('Update Payout Bank / UPI ID');
    expect(content).toContain('Payment Dispute or Missing Settlement?');
  });
});

