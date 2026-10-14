import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  OpsklThemeProvider,
  OpsklErrorBoundary,
  useOpsklTheme,
  AuthProvider,
} from '@opskil/design-system';

export { OpsklErrorBoundary as ErrorBoundary } from '@opskil/design-system';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { isDark } = useOpsklTheme();

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
