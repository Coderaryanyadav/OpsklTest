import { useEffect } from 'react';
import { Alert, View, Text, TouchableOpacity } from 'react-native';
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
import { universalStorage, supabase } from '@opskil/shared';

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
    profile,
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

        // Case 1: Unauthenticated visitor accessing protected tabs or actions
        if (!session) {
          const protectedTabs = ['create', 'roster', 'finances', 'profile'];
          if (topSegment === '(tabs)' && protectedTabs.includes(subSegment)) {
            router.replace(`/auth/login?redirect=${encodeURIComponent(`/(tabs)/${subSegment}`)}` as any);
            return;
          }

          // Check if first-time launch needs welcome tour
          const welcomeSeen = await universalStorage.getItem('@opskil_organizer_welcome_seen');
          if (!welcomeSeen && topSegment !== 'welcome' && topSegment !== 'auth') {
            router.replace('/welcome' as any);
            return;
          }
        }

        // Case 2: Authenticated organizer on welcome or login screen
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

  // Handle role mismatch (e.g. Worker credentials in Organizer app)
  if (!loading && roleMismatch) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl }}>
        <EmptyState
          title="Worker Account Detected"
          description="You are currently signed in with a Worker account. You can enable your Organizer business workspace with one tap, or switch back to the Opskl Worker app."
          actionLabel="Switch to Organizer Workspace"
          onAction={async () => {
            try {
              const { data: res } = await supabase.rpc('switch_user_role_safe', {
                p_target_role: 'organizer',
                p_business_name: profile?.fullName || 'My Agency',
                p_business_phone: profile?.phone || '',
              });
              if (res?.success) {
                await refreshProfile();
                router.replace('/(tabs)' as any);
              } else {
                Alert.alert('Role Switch Failed', res?.error || 'Could not switch to organizer profile.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Role transition failed.');
            }
          }}
        />
        <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={async () => {
              await logout();
              router.replace('/auth/login' as any);
            }}
            style={{ padding: spacing.sm }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
              Sign Out & Use Different Account
            </Text>
          </TouchableOpacity>
        </View>
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
          <AuthProvider expectedRole="organizer">
            <OpsklErrorBoundary>
              <RootNavigator />
            </OpsklErrorBoundary>
          </AuthProvider>
        </OpsklThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
