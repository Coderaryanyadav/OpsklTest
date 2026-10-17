import appConfig from '../app.json';

describe('Opskl Worker App Configuration', () => {
  test('has correct bundle identifier and package name', () => {
    expect(appConfig.expo.ios?.bundleIdentifier).toBe('com.opskil.worker');
    expect(appConfig.expo.android?.package).toBe('com.opskil.worker');
  });

  test('has correct scheme and slug', () => {
    expect(appConfig.expo.scheme).toBe('opskil-worker');
    expect(appConfig.expo.slug).toBe('opskil-worker');
    expect(appConfig.expo.name).toBe('Opskl Worker');
  });

  test('contains expo-router and splash plugins', () => {
    expect(appConfig.expo.plugins).toBeDefined();
    expect(appConfig.expo.plugins).toContain('expo-router');
  });

  test('has EAS configuration block defined for cloud builds', () => {
    expect(appConfig.expo.extra?.eas).toBeDefined();
    expect(typeof appConfig.expo.extra?.eas?.projectId).toBe('string');
  });
});
