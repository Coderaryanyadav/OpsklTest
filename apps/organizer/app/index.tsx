import { Redirect } from 'expo-router';
import { useAuth } from '@opskil/design-system';
import { View, ActivityIndicator } from 'react-native';

export default function RootIndex() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  // If user is not authenticated, never show the main screen — send straight to welcome/auth
  if (!session) {
    return <Redirect href="/welcome" />;
  }

  // Authenticated users go to main dashboard
  return <Redirect href="/(tabs)" />;
}
