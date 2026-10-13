import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Card, Badge, Button, useAuth } from '@opskil/design-system';
import { fetchOrganizerProfile, OrganizerProfile, requestAccountDeletionSafe } from '@opskil/shared';

export default function OrganizerProfileScreen() {
  const router = useRouter();
  const { session, userProfile, signOut } = useAuth();
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const [organizerData, setOrganizerData] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  useEffect(() => {
    async function loadProfile() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchOrganizerProfile(userId);
        setOrganizerData(data);
      } catch (err) {
        console.error('Failed to load organizer profile', err);
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
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your Organizer account?', [
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
      'Delete Organization Account',
      'Are you sure you want to permanently delete your Opskl organizer account? All active listings and billing history will be queued for archival in accordance with store policies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            if (userId) {
              await requestAccountDeletionSafe(userId, 'Organizer requested in-app account deletion');
            }
            await signOut();
            Alert.alert(
              'Request Registered',
              'Your organization account deletion ticket has been registered. Our accounts desk will reconcile outstanding payments within 30 days.'
            );
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const businessName = organizerData?.businessName || userProfile?.fullName || 'Event Host Organization';
  const initials = businessName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'OP';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Organization Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {loading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.textMuted }}>Loading organization…</Text>
          </View>
        ) : (
          <>
            {/* Organization Identity Card */}
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: radii.md,
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
                      {businessName}
                    </Text>
                    {organizerData?.verificationStatus === 'verified' ? (
                      <Badge label="Verified Business" variant="success" size="sm" />
                    ) : (
                      <Badge label="Pending Verification" variant="warning" size="sm" />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {organizerData?.gstin ? `GSTIN: ${organizerData.gstin}` : 'GST registration pending'} • Mumbai
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                    ★ {(organizerData?.rating ?? 5.0).toFixed(1)} Host Rating • {organizerData?.totalEventsHosted ?? 0} Shifts Hosted
                  </Text>
                </View>
              </View>
            </Card>

            {/* Business Compliance & Billing */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
                Billing & Tax Compliance
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
                Tax invoices and input tax credits (ITC) are generated under this profile.
              </Text>

              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>GSTIN Status:</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: organizerData?.gstin ? colors.success : colors.warning }}>
                    {organizerData?.gstin ? 'Verified GST Registered' : 'Not Provided'}
                  </Text>
                </View>

                {organizerData?.billingAddress ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Billing Address:</Text>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1, textAlign: 'right', marginLeft: 16 }}>
                      {organizerData.billingAddress}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Contact Phone:</Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '500' }}>
                    {organizerData?.businessContactPhone || userProfile?.phone || 'Verified'}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Button
                  title="View GST Invoices & Statements"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/(tabs)/finances')}
                />
              </View>
            </Card>

            {/* App Preferences */}
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
                    Optimized for low-light venue production booths
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>

            {/* Support & Legal */}
            <Card variant="outlined">
              <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Support & Legal
              </Text>
              <TouchableOpacity
                onPress={() => handleOpenUrl('https://opskil.com/terms')}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Organizer Terms of Service & Staffing Policies ↗
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenUrl('https://opskil.com/privacy')}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Privacy & Data Security Policy ↗
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenUrl('mailto:organizer-support@opskil.com')}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                  Dedicated Organizer Support Desk ✉
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  organizer-support@opskil.com • Dedicated account manager support
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
                  title="Request Organization Deletion"
                  variant="danger"
                  size="md"
                  onPress={handleDeleteAccount}
                />
              </View>
            </Card>

            <View style={{ alignItems: 'center', marginTop: spacing.md, paddingBottom: spacing.xl }}>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Opskl Organizer v1.0.0 • Production Release Candidate
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                App ID: com.opskil.organizer • © 2026 Opskl Technologies Pvt. Ltd.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
