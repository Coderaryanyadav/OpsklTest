import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Card, Badge, Button, useAuth } from '@opskil/design-system';
import { fetchWorkerProfile, WorkerProfile } from '@opskil/shared';

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
          router.replace('/auth/login');
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
            await signOut();
            Alert.alert(
              'Request Confirmed',
              'Your account deletion request has been submitted. Any pending settlements will be cleared, and all associated personal data will be purged within 30 days.'
            );
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const displayName = userProfile?.fullName || session?.user?.user_metadata?.full_name || 'Worker Member';
  const displayPhone = userProfile?.phone || session?.user?.phone || 'Phone verified';
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
                    ) : (
                      <Badge label="Pending Verification" variant="warning" size="sm" />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {displayPhone} {userProfile?.city ? `• ${userProfile.city}` : '• Mumbai'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                    ★ {(workerData?.rating ?? 5.0).toFixed(1)} Rating • {workerData?.shiftsCompleted ?? 0} Shifts Completed
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

            {/* Verification & KYC Status */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Identity & Compliance
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>Government ID (Aadhaar / PAN)</Text>
                {workerData?.verificationStatus === 'verified' ? (
                  <Badge label="Verified" variant="success" size="sm" />
                ) : (
                  <Badge label="In Review" variant="warning" size="sm" />
                )}
              </View>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontSize: 14, color: colors.textPrimary }}>Bank Account / UPI</Text>
                <Text style={{ fontSize: 13, color: workerData?.upiId ? colors.textPrimary : colors.textMuted, fontWeight: '500' }}>
                  {workerData?.upiId || 'Not linked'}
                </Text>
              </View>
            </Card>

            {/* Skills & Badges */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Skills & Capabilities
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
                      <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>
                        ✓ {skill}
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
