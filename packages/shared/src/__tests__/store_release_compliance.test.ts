import * as fs from 'fs';
import * as path from 'path';

describe('Phase 11: Native App Store & Google Play Release Compliance', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const workerAppJsonPath = path.join(rootDir, 'apps/worker/app.json');
  const organizerAppJsonPath = path.join(rootDir, 'apps/organizer/app.json');
  const workerEasPath = path.join(rootDir, 'apps/worker/eas.json');
  const organizerEasPath = path.join(rootDir, 'apps/organizer/eas.json');
  const playbookPath = path.join(rootDir, 'docs/APP_STORE_RELEASE_PLAYBOOK.md');

  test('Worker app.json enforces unique IDs, non-exempt encryption, and scoped permissions', () => {
    const raw = fs.readFileSync(workerAppJsonPath, 'utf8');
    const config = JSON.parse(raw).expo;

    expect(config.ios.bundleIdentifier).toBe('com.opskil.worker');
    expect(config.android.package).toBe('com.opskil.worker');
    expect(config.version).toBe('1.0.0');
    expect(config.ios.buildNumber).toBe('1');
    expect(config.android.versionCode).toBe(1);

    // Non-exempt encryption compliance
    expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);

    // Foreground-only location description
    expect(config.ios.infoPlist.NSLocationWhenInUseUsageDescription).toBeDefined();
    expect(config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined(); // No background location!
    expect(config.ios.infoPlist.NSCameraUsageDescription).toBeDefined();
    expect(config.ios.infoPlist.NSPhotoLibraryUsageDescription).toBeDefined();

    // Universal Links & App Links
    expect(config.ios.associatedDomains).toContain('applinks:opskil.com');
    expect(config.ios.associatedDomains).toContain('applinks:worker.opskil.com');
    expect(config.android.intentFilters.length).toBeGreaterThan(0);
  });

  test('Organizer app.json enforces distinct IDs and tailored permission descriptions', () => {
    const raw = fs.readFileSync(organizerAppJsonPath, 'utf8');
    const config = JSON.parse(raw).expo;

    expect(config.ios.bundleIdentifier).toBe('com.opskil.organizer');
    expect(config.android.package).toBe('com.opskil.organizer');
    expect(config.version).toBe('1.0.0');

    // Distinct bundle ID from worker
    const workerConfig = JSON.parse(fs.readFileSync(workerAppJsonPath, 'utf8')).expo;
    expect(config.ios.bundleIdentifier).not.toBe(workerConfig.ios.bundleIdentifier);
    expect(config.android.package).not.toBe(workerConfig.android.package);

    // Non-exempt encryption & scoped permissions
    expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(config.ios.infoPlist.NSLocationWhenInUseUsageDescription).toBeDefined();
    expect(config.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    expect(config.ios.associatedDomains).toContain('applinks:organizer.opskil.com');
  });

  test('EAS build configurations support Android App Bundle (AAB) for Google Play', () => {
    const workerEas = JSON.parse(fs.readFileSync(workerEasPath, 'utf8'));
    const organizerEas = JSON.parse(fs.readFileSync(organizerEasPath, 'utf8'));

    expect(workerEas.build.production.android.buildType).toBe('app-bundle');
    expect(organizerEas.build.production.android.buildType).toBe('app-bundle');
    expect(workerEas.build.production.ios.simulator).toBe(false);
    expect(organizerEas.build.production.ios.simulator).toBe(false);

    expect(workerEas.submit.production.ios.ascAppId).toBe('com.opskil.worker');
    expect(organizerEas.submit.production.ios.ascAppId).toBe('com.opskil.organizer');
    expect(workerEas.submit.production.android.track).toBe('internal');
    expect(organizerEas.submit.production.android.track).toBe('internal');
  });

  test('Release playbook exists and contains mandatory store review instructions and credentials', () => {
    const playbook = fs.readFileSync(playbookPath, 'utf8');

    expect(playbook).toContain('Apple Privacy Nutrition Labels');
    expect(playbook).toContain('Google Play Data Safety');
    expect(playbook).toContain('Reviewer Credentials');
    expect(playbook).toContain('+91 99999 00001'); // Demo worker
    expect(playbook).toContain('+91 99999 00002'); // Demo organizer
    expect(playbook).toContain('123456'); // Demo OTP
    expect(playbook).toContain('Apple Guideline 5.1.1(v)');
    expect(playbook).toContain('https://opskil.com/privacy');
    expect(playbook).toContain('https://opskil.com/terms');
  });
});
