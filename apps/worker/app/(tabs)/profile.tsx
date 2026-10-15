import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Card, Badge, Button, useAuth } from '@opskil/design-system';
import { fetchWorkerProfile, WorkerProfile, requestAccountDeletionSafe } from '@opskil/shared';

export default function WorkerProfileScreen() {
  const router = useRouter();
  const { session, userProfile, signOut } = useAuth();
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const [workerData, setWorkerData] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchWorkerProfile(userId);
        setWorkerData(data);
      } catch (err) {
        console.error('Failed to load worker profile', err);
      } finally {
        setLoading(false);
      }
    }
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
