import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  Badge,
  Button,
  useAuth,
  ErrorRetry,
} from '@opskil/design-system';
import {
  fetchWorkerProfile,
  WorkerProfile,
  requestAccountDeletionSafe,
  fetchLatestVerificationCase,
  VerificationCase,
  calculateWorkerTrustScore,
  WorkerTrustScore,
} from '@opskil/shared';
import { ShieldCheck, Info } from 'lucide-react-native';

export default function WorkerProfileScreen() {
  const router = useRouter();
  const { session, userProfile, signOut } = useAuth();
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const [workerData, setWorkerData] = useState<WorkerProfile | null>(null);
  const [verificationCase, setVerificationCase] = useState<VerificationCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const loadProfile = async () => {
    if (!userId) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const [wData, vCase] = await Promise.all([
        fetchWorkerProfile(userId),
        fetchLatestVerificationCase(userId),
      ]);
      setWorkerData(wData);
      setVerificationCase(vCase);
    } catch (err: any) {
      console.error('Failed to load worker profile', err);
      setLoadError(err?.message || 'Could not load profile. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const handleOpenUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open link', `Please visit ${url} in your browser.`);
      }
    } catch {
      Alert.alert('Notice', `Please visit ${url}`);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Opskl Worker?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your Opskl worker account? All profile information, verification records, and shift history will be permanently queued for deletion in accordance with Apple and Google Play store data safety guidelines.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const res = await requestAccountDeletionSafe(userId, 'Worker requested in-app account deletion');
            if (!res.success) {
              Alert.alert(
                'Deletion Request Denied',
                res.error || 'Your account deletion request could not be processed due to active commitments or pending settlements.'
              );
              return;
            }
            await signOut();
            Alert.alert(
              'Account Deactivated',
              'Your account has been deactivated and queued for permanent data purge in 30 days.'
            );
          },
        },
      ]
    );
  };

  const displayName = userProfile?.fullName || session?.user?.user_metadata?.full_name || 'Worker Member';
  const displayPhone = userProfile?.phone || session?.user?.phone || userProfile?.email || session?.user?.email || 'Worker Member';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'OP';

  // Calculate profile completion percentage
  const fields = [
    Boolean(userProfile?.fullName),
    Boolean(userProfile?.phone),
    Boolean(workerData?.preferredLocality),
    Boolean(workerData?.skills && workerData.skills.length > 0),
    Boolean(workerData?.upiId),
    workerData?.verificationStatus === 'verified',
  ];
  const completedFields = fields.filter(Boolean).length;
  const completionPercentage = Math.round((completedFields / fields.length) * 100);

  const trustScore: WorkerTrustScore = calculateWorkerTrustScore(workerData);

  const handleOpenAppeal = () => {
    Alert.alert(
      'Contact Support About Trust Score',
      'Opskl does not auto-create appeal tickets in-app. If you believe an attendance record or rating is inaccurate, email support with your shift details and we will review the logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support@opskil.com',
          onPress: () => {
            const subject = encodeURIComponent('Trust score review request');
            const body = encodeURIComponent(
              `Worker ID: ${userId || 'unknown'}\nName: ${displayName}\n\nPlease describe the shift date, venue, and what looks incorrect:\n`
            );
            handleOpenUrl(`mailto:support@opskil.com?subject=${subject}&body=${body}`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Worker Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {loading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.textMuted }}>Loading profile…</Text>
          </View>
        ) : loadError ? (
          <ErrorRetry
            variant="block"
            title="Could Not Load Profile"
            message={loadError}
            onRetry={() => {
              setLoading(true);
              loadProfile();
            }}
          />
        ) : !userId ? (
          <>
            {/* Guest Worker Card */}
            <Card variant="elevated">
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary }}>OP</Text>
                </View>
                <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
                  Guest Worker
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 280, lineHeight: 18 }}>
                  Sign in or complete profile registration to unlock shift applications, manage event skills, and track direct UPI payouts.
                </Text>
                <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
                  <Button
                    title="Sign In as Worker"
                    variant="primary"
                    size="md"
                    onPress={() => router.push('/auth/login?redirect=/(tabs)/profile' as any)}
                  />
                  <Button
                    title="Register Worker Account"
                    variant="outline"
                    size="md"
                    onPress={() => router.push('/onboarding' as any)}
                  />
                </View>
              </View>
            </Card>
          </>
        ) : (
          <>
            {/* User Identity Card */}
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 22, color: '#FFFFFF', fontWeight: '800' }}>{initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[typography.h3, { color: colors.textPrimary }]}>
                      {displayName}
                    </Text>
                    {workerData?.verificationStatus === 'verified' ? (
                      <Badge label="Verified Worker" variant="success" size="sm" />
                    ) : workerData?.verificationStatus === 'pending' ? (
                      <Badge label="Pending Verification" variant="warning" size="sm" />
                    ) : workerData?.verificationStatus === 'rejected' ? (
                      <Badge label="Verification Rejected" variant="danger" size="sm" />
                    ) : (
                      <Badge label="Unverified" variant="neutral" size="sm" />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {displayPhone} {userProfile?.city ? `• ${userProfile.city}` : '• Mumbai'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                    ★ {workerData?.rating && workerData.rating > 0 ? `${workerData.rating.toFixed(1)} Rating` : 'New (Unrated)'} • {workerData?.shiftsCompleted ?? 0} Shifts Completed
                  </Text>
                </View>
              </View>

              {/* Profile Completion Bar */}
              <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                    Profile Completion
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                    {completionPercentage}%
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.surfaceMuted, borderRadius: 3, overflow: 'hidden' }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${completionPercentage}%`,
                      backgroundColor: completionPercentage === 100 ? colors.success : colors.primary,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </View>
            </Card>

            {/* Stitch Masked KYC & Government Compliance Card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color={colors.accent} strokeWidth={2.2} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Government Identity (KYC)
                  </Text>
                </View>
                <Badge
                  label={
                    workerData?.verificationStatus === 'verified'
                      ? 'BANK-GRADE VERIFIED'
                      : workerData?.verificationStatus === 'pending'
                      ? 'UNDER 2-4H REVIEW'
                      : workerData?.verificationStatus === 'rejected'
                      ? 'REVISION REQUIRED'
                      : 'KYC REQUIRED'
                  }
                  variant={
                    workerData?.verificationStatus === 'verified'
                      ? 'success'
                      : workerData?.verificationStatus === 'rejected'
                      ? 'danger'
                      : workerData?.verificationStatus === 'pending'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                />
              </View>

              {/* Masked UIDAI ID Box */}
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: spacing.sm + 2,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                    Masked Identity Record
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1, marginTop: 2 }}>
                    {verificationCase?.documentMaskedId || 'No Document On File'}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>
                    Auto-Masked
                  </Text>
                </View>
              </View>

              {/* Locality & Roles Strip */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  Dispatch Base: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{workerData?.preferredLocality || 'BKC & MMR Hub'}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/onboarding' as any)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                    Edit Profile ➔
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Worker Trust and Reliability Score Card */}
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={20} color={colors.primary} strokeWidth={2.2} />
                  <Text style={[typography.h3, { color: colors.textPrimary }]}>
                    Trust & Reliability
                  </Text>
                </View>
                <Badge
                  label={`${trustScore.tier.toUpperCase()} CREW`}
                  variant="primary"
                  size="sm"
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.md, gap: 6 }}>
                <Text style={{ fontSize: 36, fontWeight: '800', color: colors.textPrimary }}>
                  {trustScore.score}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textSecondary }}>
                  / 100 Score
                </Text>
              </View>

              {/* Reliability Stats Grid */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing.md,
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Attendance</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                    {trustScore.attendanceReliabilityPct}%
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Punctuality</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                    {trustScore.punctualityRatePct}%
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>Completed Shifts</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
                    {trustScore.completedShiftsCount}
                  </Text>
                </View>
              </View>

              {/* Transparent Rules & Dispute Shielding */}
              <View style={{ marginTop: spacing.md, gap: 6 }}>
                {trustScore.breakdown.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.label}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{item.value}</Text>
                  </View>
                ))}
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: spacing.md,
                  padding: spacing.xs,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.sm,
                }}
              >
                <Info size={13} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1, lineHeight: 15 }}>
                  Fairness Guarantee: Hardware/GPS glitches or disputed shifts never automatically penalize your standing.
                </Text>
              </View>

              <View style={{ marginTop: spacing.sm }}>
                <Button
                  title="Score Transparency & Dispute Appeal"
                  variant="outline"
                  size="sm"
                  onPress={handleOpenAppeal}
                />
              </View>
            </Card>

            {/* Rejection Alert Card */}
            {workerData?.verificationStatus === 'rejected' && (
              <Card
                variant="outlined"
                style={{
                  borderColor: colors.border,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.primary,
                  backgroundColor: colors.surface,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Badge label="ACTION REQUIRED: RE-SUBMISSION" variant="danger" size="sm" />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 }}>
                  Identity Verification Needs Correction
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.sm }}>
                  Reason: {verificationCase?.rejectionReason || 'The uploaded document did not match your legal name or was illegible.'}
                </Text>
                <Button
                  title="Resubmit Verification Documents"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push('/onboarding' as any)}
                />
              </Card>
            )}

            {/* Guided Account Completion Checklist */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: 2 }]}>
                Account Completion Checklist
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Complete all 4 sections to maximize shift eligibility and automated payouts.
              </Text>

              <View style={{ gap: spacing.sm }}>
                {/* 1. Personal Details */}
                <TouchableOpacity
                  onPress={() => router.push('/onboarding' as any)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit personal information"
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      1. Personal Information
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                      {userProfile?.fullName ? `${userProfile.fullName} (${displayPhone})` : 'Name and phone contact (tap to update)'}
                    </Text>
                  </View>
                  <Badge
                    label={userProfile?.fullName ? 'COMPLETED' : 'ACTION REQUIRED'}
                    variant="neutral"
                    size="sm"
                  />
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: colors.border }} />

                {/* 2. Skills & Capabilities */}
                <TouchableOpacity
                  onPress={() => router.push('/onboarding' as any)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit event skills"
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      2. Skills & Event Capabilities
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                      {workerData?.skills && workerData.skills.length > 0
                        ? `${workerData.skills.length} skills listed (${workerData.skills.slice(0, 2).join(', ')}${workerData.skills.length > 2 ? '…' : ''})`
                        : 'No event skills selected yet (tap to add)'}
                    </Text>
                  </View>
                  <Badge
                    label={workerData?.skills && workerData.skills.length > 0 ? 'COMPLETED' : 'PENDING'}
                    variant="neutral"
                    size="sm"
                  />
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: colors.border }} />

                {/* 3. Government ID Verification */}
                <TouchableOpacity
                  onPress={() => router.push('/onboarding' as any)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel="Manage identity verification"
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      3. Identity Verification (Aadhaar / PAN)
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                      {workerData?.verificationStatus === 'verified'
                        ? 'Government KYC verified'
                        : workerData?.verificationStatus === 'pending'
                        ? 'Verification documents under review'
                        : workerData?.verificationStatus === 'rejected'
                        ? 'Verification rejected (tap to re-submit)'
                        : 'No document submitted (tap to submit KYC)'}
                    </Text>
                  </View>
                  <Badge
                    label={
                      workerData?.verificationStatus === 'verified'
                        ? 'VERIFIED'
                        : workerData?.verificationStatus === 'pending'
                        ? 'IN REVIEW'
                        : workerData?.verificationStatus === 'rejected'
                        ? 'REJECTED'
                        : 'NOT SUBMITTED'
                    }
                    variant={
                      workerData?.verificationStatus === 'verified'
                        ? 'success'
                        : workerData?.verificationStatus === 'rejected'
                        ? 'danger'
                        : workerData?.verificationStatus === 'pending'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  />
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: colors.border }} />

                {/* 4. Receiving UPI Handle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      4. Receiving Bank UPI Handle
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                      {workerData?.upiId ? workerData.upiId : 'Required for direct shift wage disbursement'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/earnings' as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Manage payout UPI handle"
                  >
                    <Badge
                      label={workerData?.upiId ? 'LINKED' : 'ADD UPI'}
                      variant="neutral"
                      size="sm"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Skills & Badges Tags */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Selected Capabilities
              </Text>
              {workerData?.skills && workerData.skills.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {workerData.skills.map((skill) => (
                    <View
                      key={skill}
                      style={{
                        backgroundColor: colors.surfaceMuted,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radii.full,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: '600' }}>
                        {skill}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  No skill tags selected yet. Complete your profile to highlight specialties.
                </Text>
              )}
            </Card>

            {/* Preferences & Theme */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Preferences
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>
                    Dark Mode
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    Adjust app theme for low-light environments
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={'#FFFFFF'}
                />
              </View>
            </Card>

            {/* Legal, Support & Store Disclosures */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Support & Legal Disclosures
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenUrl('https://opskil.com/privacy')}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Privacy Policy ↗
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Learn how Opskl protects worker identity and payment data
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenUrl('https://opskil.com/terms')}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Terms of Service & Code of Conduct ↗
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Marketplace rules, attendance guidelines and cancellation terms
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenUrl('mailto:support@opskil.com')}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Contact Opskl Support & Grievance Desk ✉
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  support@opskil.com • Response within 2 hours
                </Text>
              </TouchableOpacity>
            </Card>

            {/* Account Management */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Account Management
              </Text>
              <View style={{ gap: spacing.sm }}>
                <Button
                  title="Sign Out"
                  variant="outline"
                  size="md"
                  onPress={handleSignOut}
                />
                <Button
                  title="Delete Account & Personal Data"
                  variant="danger"
                  size="md"
                  onPress={handleDeleteAccount}
                />
              </View>
            </Card>

            <View style={{ alignItems: 'center', marginTop: spacing.md, paddingBottom: spacing.xl }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Opskl Worker v1.0.0 • Production Release Candidate
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                App ID: com.opskil.worker • © 2026 Opskl Technologies Pvt. Ltd.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
