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
});
