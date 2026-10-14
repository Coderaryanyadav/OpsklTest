import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  OpsklThemeProvider,
  OpsklErrorBoundary,
  useOpsklTheme,
  AuthProvider,
  useAuth,
} from '@opskil/design-system';
import { universalStorage } from '@opskil/shared';

export { OpsklErrorBoundary as ErrorBoundary } from '@opskil/design-system';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark } = useOpsklTheme();
  const { session, loading } = useAuth();
  const [initialEvaluated, setInitialEvaluated] = useState(false);

  useEffect(() => {
    if (loading || initialEvaluated) return;

    async function evaluateFirstLaunch() {
      try {
        const inTabsGroup = (segments as any).length === 0 || (segments as any)[0] === '(tabs)';
        if (!session && inTabsGroup) {
          const welcomeSeen = await universalStorage.getItem('@opskil_worker_welcome_seen');
          if (!welcomeSeen) {
            router.replace('/welcome' as any);
          }
        }
      } catch {
        // Fallback to tabs
      } finally {
        setInitialEvaluated(true);
      }
    }

    evaluateFirstLaunch();
  }, [loading, session, initialEvaluated, segments]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="shift/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OpsklThemeProvider>
          <AuthProvider>
            <OpsklErrorBoundary>
              <RootNavigator />
            </OpsklErrorBoundary>
          </AuthProvider>
        </OpsklThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
