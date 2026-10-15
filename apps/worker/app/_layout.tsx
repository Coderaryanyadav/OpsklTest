import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  OpsklThemeProvider,
  OpsklErrorBoundary,
  useOpsklTheme,
  AuthProvider,
  useAuth,
  EmptyState,
} from '@opskil/design-system';
import { universalStorage } from '@opskil/shared';

export { OpsklErrorBoundary as ErrorBoundary } from '@opskil/design-system';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { colors, spacing, isDark } = useOpsklTheme();
  const {
    session,
    loading,
    authState,
    roleMismatch,
    isDeactivated,
    cancelAccountDeletion,
    refreshProfile,
    logout,
  } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Splash screen hides once auth initialization finishes
    SplashScreen.hideAsync().catch(() => {});

    async function evaluateRouting() {
      try {
        const topSegment = (segments as any)[0] || '';
        const subSegment = (segments as any)[1] || '';

        // Case 1: Unauthenticated visitor accessing protected tabs or onboarding
        if (!session) {
          const protectedTab = topSegment === '(tabs)' && (subSegment === 'my-shifts' || subSegment === 'earnings' || subSegment === 'profile');
          const protectedRoute = topSegment === 'onboarding';

          if (protectedTab || protectedRoute) {
            router.replace(`/auth/login?redirect=${encodeURIComponent(topSegment === '(tabs)' ? `/(tabs)/${subSegment}` : '/onboarding')}` as any);
            return;
          }

          // Case 1b: Fresh install entering tabs directly without seeing welcome
          if (topSegment === '(tabs)' || topSegment === '') {
            const welcomeSeen = await universalStorage.getItem('@opskil_worker_welcome_seen');
            if (!welcomeSeen) {
              router.replace('/welcome' as any);
              return;
            }
          }
        }

        // Case 2: Authenticated user with incomplete profile
        if (session && authState === 'AUTHENTICATED_PROFILE_INCOMPLETE' && topSegment !== 'onboarding') {
          router.replace('/onboarding' as any);
          return;
        }

        // Case 3: Authenticated user with completed profile (or under review) visiting welcome or login
        const isAccessReady = authState === 'READY' || authState === 'VERIFICATION_PENDING' || authState === 'VERIFICATION_ACTION_REQUIRED';
        if (session && isAccessReady && (topSegment === 'welcome' || topSegment === 'auth')) {
          router.replace('/(tabs)' as any);
          return;
        }
      } catch {
        // Fallback to current screen
      }
    }

    evaluateRouting();
  }, [loading, session, authState, segments]);

  // Handle role mismatch (e.g. Organizer credentials in Worker app)
  if (!loading && roleMismatch) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl }}>
        <EmptyState
          title="Organizer Account Detected"
          description="You are currently signed in with an Organizer account. Please use the Opskl Organizer app to manage shifts, or sign out to use this Worker app."
          actionLabel="Sign Out of Organizer Account"
          onAction={async () => {
            await logout();
            router.replace('/auth/login' as any);
          }}
        />
      </SafeAreaView>
    );
  }

  // Handle deactivated account
  if (!loading && isDeactivated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl }}>
        <EmptyState
          title="Account Scheduled for Deletion"
          description="Your account is currently deactivated and pending permanent deletion. Would you like to cancel deletion and restore your account?"
          actionLabel="Restore My Account"
          onAction={async () => {
            const res = await cancelAccountDeletion();
            if (res.success) {
              await refreshProfile();
              router.replace('/(tabs)' as any);
            } else {
              Alert.alert('Restoration Failed', res.error || 'Failed to cancel deletion.');
            }
          }}
        />
      </SafeAreaView>
    );
  }

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OpsklThemeProvider>
          <AuthProvider expectedRole="worker">
            <OpsklErrorBoundary>
              <RootNavigator />
            </OpsklErrorBoundary>
          </AuthProvider>
        </OpsklThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
