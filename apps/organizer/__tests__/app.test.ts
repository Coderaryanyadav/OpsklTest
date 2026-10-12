import appConfig from '../app.json';

describe('Opskl Organizer App Configuration', () => {
  test('has correct bundle identifier and package name', () => {
    expect(appConfig.expo.ios?.bundleIdentifier).toBe('com.opskil.organizer');
    expect(appConfig.expo.android?.package).toBe('com.opskil.organizer');
  });

  test('has distinct scheme and slug from worker app', () => {
    expect(appConfig.expo.scheme).toBe('opskil-organizer');
    expect(appConfig.expo.slug).toBe('opskil-organizer');
    expect(appConfig.expo.name).toBe('Opskl Organizer');
  });

  test('contains expo-router and splash plugins', () => {
    expect(appConfig.expo.plugins).toBeDefined();
    expect(appConfig.expo.plugins).toContain('expo-router');
  });

  test('has placeholder EAS projectId documented', () => {
    expect(appConfig.expo.extra?.eas?.projectId).toBe('placeholder-organizer-project-id');
  });
});
