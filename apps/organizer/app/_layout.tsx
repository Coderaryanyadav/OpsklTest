import { useEffect } from 'react';
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
  EmptyState,
  OpsklAlert,
  Screen,
  Button,
} from '@opskil/design-system';
import { supabase } from '@opskil/shared';
import { Building2, Trash2 } from 'lucide-react-native';

export { OpsklErrorBoundary as ErrorBoundary } from '@opskil/design-system';

SplashScreen.preventAutoHideAsync().catch(() => {});

let guestBrowsingActive = false;
export function setGuestBrowsingActive(val: boolean) {
  guestBrowsingActive = val;
}
export function isGuestBrowsingActive(): boolean {
  return guestBrowsingActive;
}

import { ActivityIndicator } from 'react-native';

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

    SplashScreen.hideAsync().catch(() => {});

    async function evaluateRouting() {
      try {
        const topSegment = (segments as any)[0] || '';

        // If not authenticated, NEVER show (tabs) main dashboard screen
        if (!session) {
          if (topSegment === '(tabs)' || !topSegment) {
            router.replace('/welcome' as any);
            return;
          }
          if (topSegment !== 'welcome' && topSegment !== 'auth') {
            router.replace('/welcome' as any);
            return;
          }
        }

        const isAccessReady =
          authState === 'READY' ||
          authState === 'VERIFICATION_PENDING' ||
          authState === 'VERIFICATION_ACTION_REQUIRED';
        if (session && isAccessReady && (topSegment === 'welcome' || topSegment === 'auth' || !topSegment)) {
          router.replace('/(tabs)' as any);
          return;
        }
      } catch {
        // Fallback to current screen
      }
    }

    evaluateRouting();
  }, [loading, session, authState, segments]);

  // Prevent flashing or mounting the main dashboard while auth session is loading
  if (loading) {
    return (
      <Screen
        edges={['top', 'bottom', 'left', 'right']}
        contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!loading && roleMismatch) {
    return (
      <Screen
        edges={['top', 'bottom', 'left', 'right']}
        contentStyle={{ justifyContent: 'center', padding: spacing.xl }}
      >
        <EmptyState
          icon={<Building2 size={32} color={colors.textMuted} strokeWidth={2} />}
          title="Worker Account Detected"
          description="You are signed in with a Worker account. Enable your Organizer business workspace, or sign out to use a different account."
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
                OpsklAlert.alert('Role Switch Failed', res?.error || 'Could not switch to organizer profile.');
              }
            } catch (err: any) {
              OpsklAlert.alert('Error', err?.message || 'Role transition failed.');
            }
          }}
        />
        <Button
          title="Sign Out & Use Different Account"
          variant="ghost"
          size="sm"
          onPress={async () => {
            await logout();
            router.replace('/auth/login' as any);
          }}
          style={{ marginTop: spacing.md }}
        />
      </Screen>
    );
  }

  if (!loading && isDeactivated) {
    return (
      <Screen
        edges={['top', 'bottom', 'left', 'right']}
        contentStyle={{ justifyContent: 'center', padding: spacing.xl }}
      >
        <EmptyState
          icon={<Trash2 size={32} color={colors.textMuted} strokeWidth={2} />}
          title="Account Scheduled for Deletion"
          description="Your account is deactivated and pending permanent deletion. Restore it to keep managing shifts on Opskl."
          actionLabel="Restore My Account"
          onAction={async () => {
            const res = await cancelAccountDeletion();
            if (res.success) {
              await refreshProfile();
              router.replace('/(tabs)' as any);
            } else {
              OpsklAlert.alert('Restoration Failed', res.error || 'Failed to cancel deletion.');
            }
          }}
        />
      </Screen>
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
          name="shift/screening"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="shift/crew"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="shift/attendance"
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
