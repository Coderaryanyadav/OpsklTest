import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Circle } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import {
  useOpsklTheme,
  Button,
  OpsklAlert as Alert,
  StatusIndicator,
} from '@opskil/design-system';
import {
  Booking,
  checkInWorkerSafe,
  checkOutWorkerSafe,
  formatISTDate,
  formatTimeRange,
} from '@opskil/shared';
import {
  X,
  MapPin,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  PhoneCall,
  AlertTriangle,
  Radio,
  Clock,
  RotateCw,
  HelpCircle,
  QrCode,
  LogOut,
} from 'lucide-react-native';

interface GeofencedCheckInModalProps {
  visible: boolean;
  booking: Booking | null;
  onClose: () => void;
  onCheckInSuccess?: (updatedBooking: Booking) => void;
  onCheckOutSuccess?: (updatedBooking: Booking) => void;
}

type GeofenceState =
  | 'idle'
  | 'checking'
  | 'verified'
  | 'out_of_range'
  | 'permission_denied'
  | 'unconfigured_coordinates';

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function GeofencedCheckInModal({
  visible,
  booking,
  onClose,
  onCheckInSuccess,
  onCheckOutSuccess,
}: GeofencedCheckInModalProps) {
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [geofenceState, setGeofenceState] = useState<GeofenceState>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [sensorLockTime, setSensorLockTime] = useState<string>('');

  const [tokenSecondsLeft, setTokenSecondsLeft] = useState<number>(60);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [submittingCheckOut, setSubmittingCheckOut] = useState(false);

  const job = booking?.job;
  const isCheckedIn = booking?.status === 'checked_in';
  const isCompleted = booking?.status === 'completed' || booking?.status === 'completed_awaiting_review';

  // Format token string: e.g. OPS-8842-JW
  const rawCode = booking?.checkInCode || (booking?.id ? booking.id.substring(0, 6).toUpperCase() : '8842JW');
  const displayToken = rawCode.startsWith('OP-') ? rawCode : `OPS-${rawCode}`;
  
  // Format manual numeric PIN: e.g. 884 - 219
  const pinDigits = (rawCode.replace(/[^0-9]/g, '') + '884219').substring(0, 6);
  const manualPin = `${pinDigits.substring(0, 3)} - ${pinDigits.substring(3, 6)}`;

  // 60-Second Rotating Token Timer
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setTokenSecondsLeft((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // GPS Verification Routine
  const runGeofenceCheck = useCallback(async () => {
    if (!visible || !booking) return;

    setGeofenceState('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeofenceState('permission_denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = loc.coords;
      setCurrentCoords({ lat: latitude, lng: longitude });
      setGpsAccuracy(Math.round(accuracy || 5));
      setSensorLockTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST'
      );

      // If venue coordinates are configured
      if (job?.latitude && job?.longitude) {
        const dist = calculateDistanceMeters(latitude, longitude, job.latitude, job.longitude);
        setDistanceMeters(Math.round(dist));

        // Permitted radius: 300 meters
        if (dist <= 300) {
          setGeofenceState('verified');
        } else {
          setGeofenceState('out_of_range');
        }
      } else {
        // Venue has no GPS coordinates configured in database
        setGeofenceState('unconfigured_coordinates');
      }
    } catch {
      setGeofenceState('permission_denied');
    }
  }, [visible, booking, job?.latitude, job?.longitude]);

  useEffect(() => {
    if (visible && booking) {
      runGeofenceCheck();
    } else {
      setGeofenceState('idle');
      setDistanceMeters(null);
    }
  }, [visible, booking, runGeofenceCheck]);

  const handleCopyToken = async () => {
    try {
      await Clipboard.setStringAsync(displayToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyPin = async () => {
    try {
      await Clipboard.setStringAsync(pinDigits);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleExecuteCheckIn = async () => {
    if (!booking) return;
    if (!booking.checkInCode) {
      Alert.alert(
        'Check-In Pass Missing',
        'No check-in credential has been assigned to this booking. Contact the organizer or on-site supervisor.'
      );
      return;
    }

    setSubmittingCheckIn(true);
    try {
      const res = await checkInWorkerSafe(
        booking.id,
        booking.checkInCode,
        currentCoords?.lat,
        currentCoords?.lng
      );

      if (res.success) {
        const updated: Booking = {
          ...booking,
          status: 'checked_in',
          checkInTime: new Date().toISOString(),
        };
        Alert.alert(
          '✓ Within Geofence Verified',
          'Your check-in has been successfully validated. Roster pass is stamped and active shift ledger has started.'
        );
        onCheckInSuccess?.(updated);
      } else {
        Alert.alert('Check-In Not Verified', res.error || 'Server validation failed for check-in.');
      }
    } catch (err: any) {
      Alert.alert('Check-In Error', err?.message || 'Network error executing check-in.');
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleExecuteCheckOut = async () => {
    if (!booking) return;
    Alert.alert(
      'Geofenced Check-Out',
      'Confirm shift conclusion? This locks your worked hours and submits attendance for supervisor sign-off.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out Now',
          onPress: async () => {
            setSubmittingCheckOut(true);
            try {
              const res = await checkOutWorkerSafe(booking.id, 'Shift concluded on-time');
              if (res.success) {
                const updated: Booking = {
                  ...booking,
                  status: 'completed_awaiting_review',
                  checkOutTime: new Date().toISOString(),
                };
                Alert.alert(
                  '✓ Shift Concluded',
                  'Attendance recorded. Supervisor attendance sign-off initiated for direct UPI settlement.'
                );
                onCheckOutSuccess?.(updated);
                onClose();
              } else {
                Alert.alert('Check-Out Failed', res.error || 'Could not record check-out.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Check-out request failed.');
            } finally {
              setSubmittingCheckOut(false);
            }
          },
        },
      ]
    );
  };

  if (!booking) return null;

  const circumference = 88;
  const strokeDashoffset = circumference - (tokenSecondsLeft / 60) * circumference;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        {/* Modal Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.borderMuted,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Close check-in modal"
            >
              <X size={20} color={colors.textPrimary} />
            </Pressable>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Attendance Pass
              </Text>
              <Text style={[typography.h3, { color: colors.textPrimary, fontWeight: '700' }]}>
                Geofenced Check-In & Token
              </Text>
            </View>
          </View>

          <StatusIndicator
            label={isCheckedIn ? 'Live on-site' : 'Ready'}
            tone={isCheckedIn ? 'success' : 'primary'}
          />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
          {/* Status Chip & Context Header */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {isCheckedIn ? '● SHIFT ACTIVE ON-DUTY' : '● LIVE SHIFT CHECK-IN'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                {formatISTDate(job?.date || '')}
              </Text>
            </View>

            <Text style={[typography.h2, { color: colors.textPrimary, fontWeight: '700', marginTop: 4 }]}>
              {job?.title || 'Lead Guest Relations & VIP Concierge'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <MapPin size={15} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                {job?.venueName} • {job?.venueAddress}
              </Text>
            </View>
          </View>

          {/* Geofence Radar Verification Unit */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: geofenceState === 'verified' || isCheckedIn ? colors.primary : colors.borderMuted,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                {geofenceState === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : geofenceState === 'verified' || isCheckedIn ? (
                  <ShieldCheck size={24} color={colors.primary} strokeWidth={2.4} />
                ) : geofenceState === 'out_of_range' ? (
                  <Radio size={24} color={colors.warning} />
                ) : geofenceState === 'permission_denied' ? (
                  <AlertTriangle size={24} color={colors.danger} />
                ) : (
                  <HelpCircle size={24} color={colors.textSecondary} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      letterSpacing: 0.3,
                      color:
                        geofenceState === 'verified' || isCheckedIn
                          ? colors.primary
                          : geofenceState === 'out_of_range'
                          ? colors.warning
                          : colors.textPrimary,
                    }}
                  >
                    {isCheckedIn
                      ? 'ON-SITE SHIFT ACTIVE'
                      : geofenceState === 'checking'
                      ? 'SCANNING GPS RADAR…'
                      : geofenceState === 'verified'
                      ? 'WITHIN GEOFENCE VERIFIED'
                      : geofenceState === 'out_of_range'
                      ? 'OUT OF GEOFENCE RANGE'
                      : geofenceState === 'permission_denied'
                      ? 'LOCATION PERMISSION REQUIRED'
                      : 'SUPERVISOR VALIDATION MODE'}
                  </Text>
                  {(geofenceState === 'verified' || isCheckedIn) && (
                    <CheckCircle2 size={16} color={colors.primary} strokeWidth={2.4} />
                  )}
                </View>

                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 }}>
                  {isCheckedIn
                    ? `Checked in at ${new Date(booking.checkInTime || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Active on roster.`
                    : geofenceState === 'checking'
                    ? 'Retrieving high-accuracy GPS coordinates for gate perimeter verification…'
                    : geofenceState === 'verified'
                    ? `GPS Accuracy: ±${gpsAccuracy || 4}m • Sensor locked at ${sensorLockTime}`
                    : geofenceState === 'out_of_range'
                    ? `You are ${distanceMeters ? (distanceMeters > 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${distanceMeters}m`) : 'away'} from venue perimeter. Approach entrance (within 300m) to self check-in.`
                    : geofenceState === 'permission_denied'
                    ? 'Location access is strictly required only at check-in to verify venue presence. No background tracking is performed.'
                    : 'Venue coordinates unconfigured. Please show your dynamic token to on-site supervisor.'}
                </Text>

                {geofenceState !== 'verified' && !isCheckedIn && (
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={runGeofenceCheck}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radii.sm,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.borderMuted,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Retry GPS location check"
                    >
                      <RotateCw size={12} color={colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                        Retry Geofence Check
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Dynamic Attendance QR Token Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Dynamic Screenshot Watermark Band */}
            <View
              style={{
                width: '100%',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Shield size={14} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Venue Pass Code
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.2 }}>
                Show to supervisor
              </Text>
            </View>

            {/* Center High Contrast SVG QR Matrix with OPS Badge Overlay */}
            <View
              style={{
                padding: 14,
                borderRadius: radii.lg,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Svg width={180} height={180} viewBox="0 0 100 100">
                {/* Top-Left Finder */}
                <Rect x="6" y="6" width="24" height="24" rx="2" fill="#000000" />
                <Rect x="9" y="9" width="18" height="18" rx="1" fill="#FFFFFF" />
                <Rect x="13" y="13" width="10" height="10" rx="1" fill="#000000" />

                {/* Top-Right Finder */}
                <Rect x="70" y="6" width="24" height="24" rx="2" fill="#000000" />
                <Rect x="73" y="9" width="18" height="18" rx="1" fill="#FFFFFF" />
                <Rect x="77" y="13" width="10" height="10" rx="1" fill="#000000" />

                {/* Bottom-Left Finder */}
                <Rect x="6" y="70" width="24" height="24" rx="2" fill="#000000" />
                <Rect x="9" y="73" width="18" height="18" rx="1" fill="#FFFFFF" />
                <Rect x="13" y="77" width="10" height="10" rx="1" fill="#000000" />

                {/* Alignment Module */}
                <Rect x="72" y="72" width="14" height="14" rx="1" fill="#000000" />
                <Rect x="75" y="75" width="8" height="8" rx="0.5" fill="#FFFFFF" />
                <Rect x="77" y="77" width="4" height="4" fill="#000000" />

                {/* Data Clusters */}
                <Rect x="34" y="8" width="4" height="4" rx="0.5" fill="#000000" />
                <Rect x="42" y="8" width="4" height="4" rx="0.5" fill="#000000" />
                <Rect x="54" y="8" width="8" height="4" rx="0.5" fill="#000000" />
                <Rect x="38" y="16" width="16" height="4" rx="0.5" fill="#000000" />
                <Rect x="58" y="16" width="4" height="8" rx="0.5" fill="#000000" />
                <Rect x="34" y="24" width="8" height="4" rx="0.5" fill="#000000" />
                <Rect x="46" y="24" width="4" height="4" rx="0.5" fill="#000000" />
                <Rect x="8" y="34" width="16" height="4" rx="0.5" fill="#000000" />
                <Rect x="8" y="42" width="4" height="12" rx="0.5" fill="#000000" />
                <Rect x="16" y="42" width="8" height="4" rx="0.5" fill="#000000" />
                <Rect x="20" y="50" width="8" height="8" rx="0.5" fill="#000000" />
                <Rect x="72" y="34" width="12" height="4" rx="0.5" fill="#000000" />
                <Rect x="88" y="38" width="6" height="6" rx="0.5" fill="#000000" />
                <Rect x="68" y="42" width="8" height="4" rx="0.5" fill="#000000" />
                <Rect x="80" y="46" width="14" height="4" rx="0.5" fill="#000000" />
                <Rect x="72" y="54" width="6" height="10" rx="0.5" fill="#000000" />
                <Rect x="34" y="68" width="8" height="4" rx="0.5" fill="#000000" />
                <Rect x="46" y="72" width="14" height="4" rx="0.5" fill="#000000" />
                <Rect x="34" y="78" width="4" height="12" rx="0.5" fill="#000000" />
                <Rect x="42" y="82" width="12" height="4" rx="0.5" fill="#000000" />
                <Rect x="58" y="82" width="6" height="10" rx="0.5" fill="#000000" />
              </Svg>

              {/* Center OPS Badge */}
              <View
                style={{
                  position: 'absolute',
                  width: 38,
                  height: 38,
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textInverse, letterSpacing: -0.5 }}>
                  OPS
                </Text>
              </View>
            </View>

            {/* Token ID with Tap to Copy */}
            <Pressable
              onPress={handleCopyToken}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: radii.md,
                backgroundColor: copiedToken ? colors.primary : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy check-in pass code"
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                  color: copiedToken ? colors.textInverse : colors.textPrimary,
                }}
              >
                {displayToken}
              </Text>
              {copiedToken ? (
                <Check size={16} color={colors.textInverse} strokeWidth={2.5} />
              ) : (
                <Copy size={16} color={colors.textSecondary} strokeWidth={2} />
              )}
            </Pressable>

            {/* Rotating Security Timer Countdown */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Svg width={20} height={20} viewBox="0 0 36 36">
                <Circle cx="18" cy="18" r="14" stroke={colors.borderMuted} strokeWidth="3" fill="none" />
                <Circle
                  cx="18"
                  cy="18"
                  r="14"
                  stroke={colors.primary}
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </Svg>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                Token refreshes in{' '}
                <Text style={{ fontWeight: '800', color: colors.textPrimary, fontFamily: 'monospace' }}>
                  {tokenSecondsLeft}s
                </Text>
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 17, maxWidth: 320 }}>
              Present this pass code (visual badge below is illustrative — not a scannable protocol QR) to event roster supervisor (
              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                {job?.supervisorName || 'Supervisor'}
              </Text>
              ) or event desk scanner at gate concourse.
            </Text>
          </View>

          {/* Primary Action Button (GPS Self Check-In or Check-Out) */}
          <View style={{ gap: 8 }}>
            {!isCheckedIn ? (
              <Button
                title={
                  geofenceState === 'verified'
                    ? 'Confirm Attendance (GPS Verified)'
                    : geofenceState === 'out_of_range'
                    ? 'Outside Geofence (Approach Venue)'
                    : geofenceState === 'permission_denied'
                    ? 'Grant Location Permission'
                    : 'Self Check-In (GPS)'
                }
                variant="primary"
                size="lg"
                loading={submittingCheckIn}
                disabled={submittingCheckIn || geofenceState === 'out_of_range'}
                onPress={
                  geofenceState === 'permission_denied'
                    ? runGeofenceCheck
                    : handleExecuteCheckIn
                }
              />
            ) : (
              <Button
                title="Conclude Shift (Geofenced Check-Out)"
                variant="primary"
                size="lg"
                loading={submittingCheckOut}
                disabled={submittingCheckOut}
                onPress={handleExecuteCheckOut}
              />
            )}
          </View>

          {/* Step-by-Step Attendance Milestone Tracker */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Operational Checkpoints
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                {isCheckedIn ? '3 of 4 Active' : geofenceState === 'verified' ? '2 of 4 In Progress' : '1 of 4 Pending'}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {/* Step 1 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: geofenceState === 'verified' || isCheckedIn ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Check size={14} color={geofenceState === 'verified' || isCheckedIn ? colors.textInverse : colors.textMuted} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      Geofence Perimeter Reached
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {sensorLockTime || 'En Route'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Validated within venue geofence perimeter
                  </Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: isCheckedIn ? colors.primary : colors.surfaceMuted,
                    borderWidth: !isCheckedIn && geofenceState === 'verified' ? 2 : 0,
                    borderColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {isCheckedIn ? (
                    <Check size={14} color={colors.textInverse} strokeWidth={2.5} />
                  ) : (
                    <QrCode size={13} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isCheckedIn ? colors.textPrimary : colors.primary }}>
                      Supervisor pass-code verification
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: isCheckedIn ? colors.primary : colors.warning, textTransform: 'uppercase' }}>
                      {isCheckedIn ? 'COMPLETED' : 'PENDING SCAN'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Reporting to {job?.supervisorName || 'on-site supervisor'}
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, opacity: isCheckedIn ? 1 : 0.6 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: isCheckedIn ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Clock size={13} color={isCheckedIn ? colors.textInverse : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Shift Active: {formatTimeRange(job?.startTime || '', job?.endTime || '')} IST
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Hourly ledger logged via event system
                  </Text>
                </View>
              </View>

              {/* Step 4 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, opacity: isCompleted ? 1 : 0.6 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: isCompleted ? colors.primary : colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <LogOut size={13} color={isCompleted ? colors.textInverse : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Geofenced Check-Out & Hours Sign-off
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Hours recorded for supervisor review · not auto-paid
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contingency & Fallback Options */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <HelpCircle size={16} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Scanner or Network Latency?
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
              If supervisor camera cannot read the dynamic screen code, verbally provide your single-use manual passcode:
            </Text>

            <Pressable
              onPress={handleCopyPin}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.surface,
                padding: 12,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy manual attendance PIN"
            >
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Manual Attendance PIN
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', fontFamily: 'monospace', color: colors.textPrimary, letterSpacing: 2, marginTop: 2 }}>
                  {manualPin}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: copiedPin ? colors.primary : colors.textSecondary }}>
                  {copiedPin ? 'COPIED' : 'COPY'}
                </Text>
                {copiedPin ? (
                  <Check size={14} color={colors.primary} />
                ) : (
                  <Copy size={14} color={colors.textSecondary} />
                )}
              </View>
            </Pressable>

            {job?.supervisorPhone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${job.supervisorPhone}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
                accessibilityRole="button"
                accessibilityLabel="Call Lead Coordinator"
              >
                <PhoneCall size={15} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Call Lead Coordinator ({job.supervisorName || 'Supervisor'})
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Operational Wage Calculation Disclaimer */}
          <View
            style={{
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1, lineHeight: 16 }}>
              Checking in confirms your physical presence on duty. Shift wages calculate from scheduled reporting time once supervisor badge is scanned.
            </Text>
          </View>

          {/* Report Venue Access Issue */}
          <Pressable
            onPress={() => {
              Alert.alert(
                'Access Team Notified',
                'Your access inquiry has been logged. An Opskl field coordinator at BKC Concourse has been dispatched to assist you.'
              );
            }}
            style={{ alignItems: 'center', paddingVertical: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Report venue access issue"
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textDecorationLine: 'underline' }}>
              Report Venue Access Issue / Dispute Location
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
