/**
 * Opskl Automated High-Resolution Screenshot Capture Script
 * Uses Playwright to capture retina (@2x) screenshots of all screens
 * across Worker Mobile App, Organizer Mobile App, and Admin Web Console.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ROOT_DIR = process.cwd();
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'screenshots');
const WORKER_DIR = path.join(SCREENSHOTS_DIR, 'worker');
const ORGANIZER_DIR = path.join(SCREENSHOTS_DIR, 'organizer');
const ADMIN_DIR = path.join(SCREENSHOTS_DIR, 'admin');

// Ensure output directories exist
[SCREENSHOTS_DIR, WORKER_DIR, ORGANIZER_DIR, ADMIN_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 14 / 15
const DESKTOP_VIEWPORT = { width: 1440, height: 900 }; // MacBook Pro 14"

function checkHttpReady(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
      } else {
        setTimeout(check, 800);
      }
    };

    check();
  });
}

async function run() {
  console.log('====================================================');
  console.log('   OPSKL AUTOMATED SCREENSHOT CAPTURE ENGINE');
  console.log('====================================================\n');

  let adminProcess = null;
  const isPort3000Ready = await checkHttpReady('http://localhost:3000/login', 2000);

  if (!isPort3000Ready) {
    console.log('[1/4] Starting Admin dev server on port 3000...');
    adminProcess = spawn('npx', ['next', 'dev', 'apps/admin', '--port', '3000'], {
      cwd: ROOT_DIR,
      stdio: 'ignore',
      env: { ...process.env, NEXT_PUBLIC_APP_ENV: 'development' },
    });

    const ready = await checkHttpReady('http://localhost:3000/login', 30000);
    if (!ready) {
      console.warn('⚠️ Admin server did not respond in 30s. Admin screenshots may be skipped.');
    } else {
      console.log('✓ Admin server is ready on http://localhost:3000');
    }
  } else {
    console.log('✓ Admin server is already running on http://localhost:3000');
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const capturedScreens = [];

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: WORKER APP SCREENSHOTS (Port 8081)
    // -------------------------------------------------------------------------
    console.log('\n[2/4] Capturing Worker Mobile App screens (Port 8081)...');
    const workerContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      deviceScaleFactor: 2,
    });
    const workerPage = await workerContext.newPage();

    // 1. Worker Welcome
    console.log('  -> Capturing Worker Welcome...');
    await workerPage.goto('http://localhost:8081/welcome');
    await workerPage.waitForTimeout(2000);
    const workerWelcomePath = path.join(WORKER_DIR, '01_worker_welcome.png');
    await workerPage.screenshot({ path: workerWelcomePath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Welcome & Value Proposition',
      file: 'worker/01_worker_welcome.png',
      route: '/welcome',
      viewport: '390 × 844 (Retina @2x)',
      description: 'First launch onboarding with monochrome brand monogram, trust badges, and role routing',
    });

    // 2. Worker Login
    console.log('  -> Capturing Worker Login...');
    await workerPage.goto('http://localhost:8081/auth/login');
    await workerPage.waitForTimeout(2000);
    const workerLoginPath = path.join(WORKER_DIR, '02_worker_login.png');
    await workerPage.screenshot({ path: workerLoginPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Authentication & OTP Login',
      file: 'worker/02_worker_login.png',
      route: '/auth/login',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Passwordless OTP / Email sign-in with 48px touch targets and field validation',
    });

    // 3. Worker Discover (Shift Feed)
    console.log('  -> Capturing Worker Discover Shift Feed...');
    await workerPage.evaluate(() => {
      localStorage.setItem('@opskil_worker_welcome_seen', 'true');
    });
    await workerPage.goto('http://localhost:8081');
    await workerPage.waitForTimeout(3000);
    const workerDiscoverPath = path.join(WORKER_DIR, '03_worker_discover.png');
    await workerPage.screenshot({ path: workerDiscoverPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Discover Shift Swipe Feed',
      file: 'worker/03_worker_discover.png',
      route: '/(tabs)',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Signature discovery feed with card swipe gestures, skip/apply buttons, wages & venues',
    });

    // 4. Worker Onboarding
    console.log('  -> Capturing Worker Onboarding KYC...');
    await workerPage.goto('http://localhost:8081/onboarding');
    await workerPage.waitForTimeout(2000);
    const workerOnboardingPath = path.join(WORKER_DIR, '04_worker_onboarding.png');
    await workerPage.screenshot({ path: workerOnboardingPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Worker Registration & KYC',
      file: 'worker/04_worker_onboarding.png',
      route: '/onboarding',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Progressive multi-step KYC verification for Aadhaar and PAN documents',
    });

    // Enable Authenticated Worker Session
    await workerPage.evaluate(() => {
      localStorage.setItem('@opskil_test_session', 'worker');
    });

    // 5. Worker My Shifts
    console.log('  -> Capturing Worker My Shifts...');
    await workerPage.goto('http://localhost:8081/(tabs)/my-shifts');
    await workerPage.waitForTimeout(3000);
    const workerShiftsPath = path.join(WORKER_DIR, '05_worker_my_shifts.png');
    await workerPage.screenshot({ path: workerShiftsPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'My Shifts & Attendance Hub',
      file: 'worker/05_worker_my_shifts.png',
      route: '/(tabs)/my-shifts',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Active & upcoming shift bookings with two-tiered action bar, GPS check-in & dynamic QR',
    });

    // 6. Worker Earnings
    console.log('  -> Capturing Worker Earnings...');
    await workerPage.goto('http://localhost:8081/(tabs)/earnings');
    await workerPage.waitForTimeout(3000);
    const workerEarningsPath = path.join(WORKER_DIR, '06_worker_earnings.png');
    await workerPage.screenshot({ path: workerEarningsPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Worker Earnings & Payout Ledger',
      file: 'worker/06_worker_earnings.png',
      route: '/(tabs)/earnings',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Transparent wage breakdown (available, pending escrow, settled) and instant UPI payout desk',
    });

    // 7. Worker Profile
    console.log('  -> Capturing Worker Profile...');
    await workerPage.goto('http://localhost:8081/(tabs)/profile');
    await workerPage.waitForTimeout(3000);
    const workerProfilePath = path.join(WORKER_DIR, '07_worker_profile.png');
    await workerPage.screenshot({ path: workerProfilePath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Worker Profile & Compliance Badges',
      file: 'worker/07_worker_profile.png',
      route: '/(tabs)/profile',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Worker identity with Aadhaar & PAN verification badges, skills chips, and emergency contact',
    });

    // 8. Worker Notifications
    console.log('  -> Capturing Worker Notifications...');
    await workerPage.goto('http://localhost:8081/notifications');
    await workerPage.waitForTimeout(3000);
    const workerNotifsPath = path.join(WORKER_DIR, '08_worker_notifications.png');
    await workerPage.screenshot({ path: workerNotifsPath });
    capturedScreens.push({
      category: 'Worker Mobile App',
      name: 'Notifications & Dispatch Alerts',
      file: 'worker/08_worker_notifications.png',
      route: '/notifications',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Shift broadcast inbox and granular dispatch alert preferences',
    });

    await workerContext.close();

    // -------------------------------------------------------------------------
    // SECTION 2: ORGANIZER APP SCREENSHOTS (Port 8082)
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Capturing Organizer Mobile App screens (Port 8082)...');
    const organizerContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      deviceScaleFactor: 2,
    });
    const organizerPage = await organizerContext.newPage();

    // 1. Organizer Welcome
    console.log('  -> Capturing Organizer Welcome...');
    await organizerPage.goto('http://localhost:8082/welcome');
    await organizerPage.waitForTimeout(2000);
    const orgWelcomePath = path.join(ORGANIZER_DIR, '01_organizer_welcome.png');
    await organizerPage.screenshot({ path: orgWelcomePath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Organizer Welcome Tour',
      file: 'organizer/01_organizer_welcome.png',
      route: '/welcome',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Enterprise event staffing introduction with corporate trust indicators',
    });

    // 2. Organizer Login
    console.log('  -> Capturing Organizer Login...');
    await organizerPage.goto('http://localhost:8082/auth/login');
    await organizerPage.waitForTimeout(2000);
    const orgLoginPath = path.join(ORGANIZER_DIR, '02_organizer_login.png');
    await organizerPage.screenshot({ path: orgLoginPath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Organizer Authentication',
      file: 'organizer/02_organizer_login.png',
      route: '/auth/login',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Agency authentication with GSTIN corporate sign-in options',
    });

    // Enable Authenticated Organizer Session
    await organizerPage.evaluate(() => {
      localStorage.setItem('@opskil_organizer_welcome_seen', 'true');
      localStorage.setItem('@opskil_test_session', 'organizer');
    });

    // 3. Organizer Active Roster
    console.log('  -> Capturing Organizer Active Roster...');
    await organizerPage.goto('http://localhost:8082/(tabs)');
    await organizerPage.waitForTimeout(3000);
    const orgRosterPath = path.join(ORGANIZER_DIR, '03_organizer_roster.png');
    await organizerPage.screenshot({ path: orgRosterPath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Shift Management & Staffing Roster',
      file: 'organizer/03_organizer_roster.png',
      route: '/(tabs)',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Real-time event shift dashboard, staffing headcount tracking, and applicant management',
    });

    // 4. Organizer Create Shift
    console.log('  -> Capturing Organizer Create Shift Flow...');
    await organizerPage.goto('http://localhost:8082/(tabs)/create');
    await organizerPage.waitForTimeout(3000);
    const orgCreatePath = path.join(ORGANIZER_DIR, '04_organizer_create_shift.png');
    await organizerPage.screenshot({ path: orgCreatePath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Shift Creation & Publishing Workflow',
      file: 'organizer/04_organizer_create_shift.png',
      route: '/(tabs)/create',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Step-by-step role categorization, living wage calculator, venue selection, and draft review',
    });

    // 5. Organizer Finances
    console.log('  -> Capturing Organizer Finances...');
    await organizerPage.goto('http://localhost:8082/(tabs)/finances');
    await organizerPage.waitForTimeout(3000);
    const orgFinancesPath = path.join(ORGANIZER_DIR, '05_organizer_finances.png');
    await organizerPage.screenshot({ path: orgFinancesPath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Escrow Finances & Billing Invoices',
      file: 'organizer/05_organizer_finances.png',
      route: '/(tabs)/finances',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Committed event wage escrow, GSTIN invoices, and real-time payment reconciliation',
    });

    // 6. Organizer Profile
    console.log('  -> Capturing Organizer Profile...');
    await organizerPage.goto('http://localhost:8082/(tabs)/profile');
    await organizerPage.waitForTimeout(3000);
    const orgProfilePath = path.join(ORGANIZER_DIR, '06_organizer_profile.png');
    await organizerPage.screenshot({ path: orgProfilePath });
    capturedScreens.push({
      category: 'Organizer Mobile App',
      name: 'Agency Profile & Business Verification',
      file: 'organizer/06_organizer_profile.png',
      route: '/(tabs)/profile',
      viewport: '390 × 844 (Retina @2x)',
      description: 'Corporate agency identity with GSTIN verification status and authorized team coordinators',
    });

    await organizerContext.close();

    // -------------------------------------------------------------------------
    // SECTION 3: ADMIN WEB DASHBOARD (Port 3000)
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Capturing Admin Operations Web Console (Port 3000)...');
    const adminDesktopContext = await browser.newContext({
      viewport: DESKTOP_VIEWPORT,
      deviceScaleFactor: 2,
    });
    const adminPage = await adminDesktopContext.newPage();

    // 1. Admin Login
    console.log('  -> Capturing Admin Login...');
    await adminPage.goto('http://localhost:3000/login');
    await adminPage.waitForTimeout(2000);
    const adminLoginPath = path.join(ADMIN_DIR, '01_admin_login.png');
    await adminPage.screenshot({ path: adminLoginPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Admin Command Portal Login',
      file: 'admin/01_admin_login.png',
      route: '/login',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Restricted administrative portal authentication with security indicators',
    });

    // Set Admin Test Session Cookie
    await adminDesktopContext.addCookies([
      {
        name: 'opskil_test_session',
        value: 'admin',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 2. Admin Platform Overview (Desktop)
    console.log('  -> Capturing Admin Platform Overview (Desktop)...');
    await adminPage.goto('http://localhost:3000');
    await adminPage.waitForTimeout(3000);
    const adminOverviewPath = path.join(ADMIN_DIR, '02_admin_overview_desktop.png');
    await adminPage.screenshot({ path: adminOverviewPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Operations Overview (Desktop)',
      file: 'admin/02_admin_overview_desktop.png',
      route: '/',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Real-time GMV liquidity, active shifts, workforce volume, and platform health telemetry',
    });

    // 3. Admin Verification Queue
    console.log('  -> Capturing Admin KYC Verification Queue...');
    await adminPage.click('text=Verification Queue');
    await adminPage.waitForTimeout(1500);
    const adminKycPath = path.join(ADMIN_DIR, '03_admin_verification_queue.png');
    await adminPage.screenshot({ path: adminKycPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Identity & Business KYC Queue',
      file: 'admin/03_admin_verification_queue.png',
      route: '/ (module: verifications)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Worker Aadhaar & PAN KYC review desk and Organizer GSTIN business compliance review',
    });

    // 4. Admin Attendance & Wage Disputes
    console.log('  -> Capturing Admin Disputes Queue...');
    await adminPage.click('text=Attendance Disputes');
    await adminPage.waitForTimeout(1500);
    const adminDisputesPath = path.join(ADMIN_DIR, '04_admin_disputes_queue.png');
    await adminPage.screenshot({ path: adminDisputesPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Attendance & Wage Disputes Arbitration',
      file: 'admin/04_admin_disputes_queue.png',
      route: '/ (module: disputes)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Supervisor sign-off arbitration, GPS audit trail, and wage escrow adjustment desk',
    });

    // 5. Admin Safety Reports
    console.log('  -> Capturing Admin Safety Reports...');
    await adminPage.click('text=Safety Reports');
    await adminPage.waitForTimeout(1500);
    const adminSafetyPath = path.join(ADMIN_DIR, '05_admin_safety_reports.png');
    await adminPage.screenshot({ path: adminSafetyPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Safety Reports & Grievances',
      file: 'admin/05_admin_safety_reports.png',
      route: '/ (module: safety)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Critical workplace grievance incident management and SOS safety audit desk',
    });

    // 6. Admin Worker Directory
    console.log('  -> Capturing Admin Worker Talent Pool...');
    await adminPage.click('text=Worker Talent Pool');
    await adminPage.waitForTimeout(1500);
    const adminWorkersPath = path.join(ADMIN_DIR, '06_admin_worker_directory.png');
    await adminPage.screenshot({ path: adminWorkersPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Verified Worker Talent Pool Directory',
      file: 'admin/06_admin_worker_directory.png',
      route: '/ (module: workers)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Workforce search directory with skill filters, Aadhaar badge audit, and account suspension controls',
    });

    // 7. Admin Organizer Directory
    console.log('  -> Capturing Admin Agencies Directory...');
    await adminPage.click('text=Agencies & Organizers');
    await adminPage.waitForTimeout(1500);
    const adminOrgsPath = path.join(ADMIN_DIR, '07_admin_organizer_directory.png');
    await adminPage.screenshot({ path: adminOrgsPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Event Agencies & Organizers Directory',
      file: 'admin/07_admin_organizer_directory.png',
      route: '/ (module: organizers)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Verified production houses, corporate agencies, GSTIN records, and event hosting records',
    });

    // 8. Admin Shift Moderation
    console.log('  -> Capturing Admin Shift Moderation...');
    await adminPage.click('text=Shift Moderation');
    await adminPage.waitForTimeout(1500);
    const adminShiftsPath = path.join(ADMIN_DIR, '08_admin_shift_moderation.png');
    await adminPage.screenshot({ path: adminShiftsPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Shift Moderation & Living Wage Floor',
      file: 'admin/08_admin_shift_moderation.png',
      route: '/ (module: jobs)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Living wage floor enforcement (min ₹200/hr) and active listing moderation controls',
    });

    // 9. Admin Audit Logs
    console.log('  -> Capturing Admin Audit Logs...');
    await adminPage.click('text=Audit Logs');
    await adminPage.waitForTimeout(1500);
    const adminAuditPath = path.join(ADMIN_DIR, '09_admin_audit_logs.png');
    await adminPage.screenshot({ path: adminAuditPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Immutable Administrative Audit Trail',
      file: 'admin/09_admin_audit_logs.png',
      route: '/ (module: audit)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Cryptographically sealed administrative audit trail recording all privileged actions',
    });

    // 10. Admin System Configuration & Killswitch
    console.log('  -> Capturing Admin System Configuration...');
    await adminPage.click('text=System Configuration');
    await adminPage.waitForTimeout(1500);
    const adminSettingsPath = path.join(ADMIN_DIR, '10_admin_settings_killswitch.png');
    await adminPage.screenshot({ path: adminSettingsPath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Platform Settings & Booking Killswitch',
      file: 'admin/10_admin_settings_killswitch.png',
      route: '/ (module: settings)',
      viewport: '1440 × 900 (Desktop @2x)',
      description: 'Operational killswitch controls, marketplace commission rates, and minimum wage floors',
    });

    await adminDesktopContext.close();

    // 11. Admin Responsive Mobile View
    console.log('  -> Capturing Admin Mobile Responsive View...');
    const adminMobileContext = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      deviceScaleFactor: 2,
    });
    await adminMobileContext.addCookies([
      {
        name: 'opskil_test_session',
        value: 'admin',
        domain: 'localhost',
        path: '/',
      },
    ]);
    const adminMobilePage = await adminMobileContext.newPage();
    await adminMobilePage.goto('http://localhost:3000');
    await adminMobilePage.waitForTimeout(2500);
    const adminMobilePath = path.join(ADMIN_DIR, '11_admin_overview_mobile.png');
    await adminMobilePage.screenshot({ path: adminMobilePath });
    capturedScreens.push({
      category: 'Admin Web Console',
      name: 'Mobile Operations Console (Responsive)',
      file: 'admin/11_admin_overview_mobile.png',
      route: '/',
      viewport: '390 × 844 (Mobile @2x)',
      description: 'Mobile web responsive layout adapting the enterprise console for on-the-go oversight',
    });

    await adminMobileContext.close();
  } finally {
    await browser.close();
    if (adminProcess) {
      console.log('\nCleaning up Admin process...');
      adminProcess.kill();
    }
  }

  // Generate Catalog README.md
  console.log('\nGenerating screenshots catalog README.md...');
  let readme = `# Opskl — UI/UX Screenshots & Visual Design Gallery\n\n`;
  readme += `High-resolution retina (@2x) screenshots of all screens across the Opskl platform.\n`;
  readme += `Theme: **Strict Monochrome** (\`#000000\` Black, \`#FFFFFF\` White, \`#F5F5F5\` Light Neutral, curated neutral greys).\n\n`;
  readme += `### Summary by Application\n\n`;
  readme += `- **Worker Mobile App**: 8 screens (\`screenshots/worker/\`)\n`;
  readme += `- **Organizer Mobile App**: 6 screens (\`screenshots/organizer/\`)\n`;
  readme += `- **Admin Operations Console**: 11 screens (\`screenshots/admin/\`)\n\n`;
  readme += `---\n\n`;

  const categories = ['Worker Mobile App', 'Organizer Mobile App', 'Admin Web Console'];
  for (const cat of categories) {
    readme += `## ${cat}\n\n`;
    readme += `| Screen Name | Viewport | Relative Path | Key Highlights |\n`;
    readme += `|---|---|---|---|\n`;

    const screens = capturedScreens.filter((s) => s.category === cat);
    for (const s of screens) {
      readme += `| **${s.name}** | \`${s.viewport}\` | [\`${s.file}\`](./${s.file}) | ${s.description} |\n`;
    }
    readme += `\n`;
  }

  readme += `---\n\n*Generated automatically by \`scripts/capture_all_screenshots.mjs\`*\n`;
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'README.md'), readme, 'utf8');

  console.log('\n====================================================');
  console.log(`✅ Successfully captured ${capturedScreens.length} screens!`);
  console.log(`📁 All screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log(`📄 Catalog generated: ${path.join(SCREENSHOTS_DIR, 'README.md')}`);
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Fatal screenshot capture error:', err);
  process.exit(1);
});
