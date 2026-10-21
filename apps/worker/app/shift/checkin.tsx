import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOpsklTheme, useAuth, Button, ScreenHeader } from '@opskil/design-system';
import { Booking, fetchWorkerBookings } from '@opskil/shared';
import { GeofencedCheckInModal } from '../../src/components/GeofencedCheckInModal';

export default function ShiftCheckInScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing } = useOpsklTheme();
  const { bookingId, id } = useLocalSearchParams<{ bookingId?: string; id?: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }
      try {
        const bookings = await fetchWorkerBookings(session.user.id);
        const targetId = bookingId || id;
        const found = bookings.find(
          (b) => b.id === targetId || b.jobId === targetId || b.job?.id === targetId
        );
        if (found) {
          setBooking(found);
        } else if (bookings.length > 0) {
          setBooking(bookings[0]);
        }
      } catch (err) {
        console.error('Failed to load booking for check-in', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId, id, session?.user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>
          Loading check-in pass…
        </Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
        <ScreenHeader title="Check-In" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
            No Active Booking Found
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
            You do not have an active confirmed shift ready for check-in.
          </Text>
          <View style={{ marginTop: 20, width: 200 }}>
            <Button title="Back to Shifts" variant="primary" size="md" onPress={() => router.replace('/(tabs)/my-shifts')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GeofencedCheckInModal
      visible={true}
      booking={booking}
      onClose={() => router.back()}
      onCheckInSuccess={(updated) => {
        setBooking(updated);
      }}
      onCheckOutSuccess={() => {
        router.replace('/(tabs)/my-shifts');
      }}
    />
  );
}
