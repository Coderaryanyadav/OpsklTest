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

  // If worker is not authenticated, send to welcome screen immediately
  if (!session) {
    return <Redirect href="/welcome" />;
  }

  // Authenticated workers go to marketplace
  return <Redirect href="/(tabs)" />;
}
