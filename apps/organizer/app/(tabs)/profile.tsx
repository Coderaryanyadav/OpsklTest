import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, Linking, Alert, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpsklTheme, Card, Badge, Button, Input, useAuth } from '@opskil/design-system';
import {
  fetchOrganizerProfile,
  updateOrganizerProfile,
  OrganizerProfile,
  requestAccountDeletionSafe,
  submitVerificationCaseSafe,
  uploadVerificationDocument,
} from '@opskil/shared';
import { GstinSchema } from '@opskil/validation';

export default function OrganizerProfileScreen() {
  const router = useRouter();
  const { session, userProfile, signOut } = useAuth();
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const [organizerData, setOrganizerData] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit organization profile state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const handleOpenEdit = () => {
    setFormBusinessName(organizerData?.businessName || userProfile?.fullName || '');
    setFormGstin(organizerData?.gstin || '');
    setFormBillingAddress(organizerData?.billingAddress || '');
    setFormContactPhone(organizerData?.businessContactPhone || userProfile?.phone || '');
    setEditError(null);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    if (formBusinessName.trim().length < 2) {
      setEditError('Please enter a valid organization or business name.');
      return;
    }
    const trimmedGstin = formGstin.trim().toUpperCase();
    if (trimmedGstin) {
      const gstinResult = GstinSchema.safeParse(trimmedGstin);
      if (!gstinResult.success) {
        setEditError('Please enter a valid 15-character Indian GSTIN (e.g. 27AABCA1234F1Z5)');
        return;
      }
    }
    setSaving(true);
    setEditError(null);
    try {
      await updateOrganizerProfile(userId, {
        businessName: formBusinessName.trim(),
        gstin: trimmedGstin || undefined,
        billingAddress: formBillingAddress.trim() || undefined,
        contactPhone: formContactPhone.trim() || undefined,
        profileCompletionStatus: 'completed',
      });

      if (trimmedGstin) {
        // Upload certificate to private storage bucket before submitting verification case
        const certificateBlob = `GSTIN_DOCUMENT_EVIDENCE_${trimmedGstin}_${userId}_${Date.now()}`;
        const uploadRes = await uploadVerificationDocument(
          userId,
          'gstin',
          certificateBlob,
          'application/pdf'
        );

        if (!uploadRes.success || !uploadRes.storagePath) {
          throw new Error(uploadRes.error || 'Failed to upload GSTIN certificate to secure storage.');
        }

        const verifyRes = await submitVerificationCaseSafe(
          'gstin',
          trimmedGstin,
          uploadRes.storagePath
        );

        if (!verifyRes.success) {
          throw new Error(verifyRes.error || 'Failed to register GSTIN verification review case.');
        }
      }

      const updated = await fetchOrganizerProfile(userId);
      setOrganizerData(updated);
      setEditModalVisible(false);
      Alert.alert(
        'Profile Updated',
        trimmedGstin
          ? 'Organization details saved and GSTIN verification case submitted for admin review.'
          : 'Organization profile details have been saved.'
      );
    } catch (err: any) {
      setEditError(err.message || 'Failed to update organization profile.');
    } finally {
      setSaving(false);
    }
  };

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
            if (!userId) return;
            const res = await requestAccountDeletionSafe(userId, 'Organizer requested in-app account deletion');
            if (!res.success) {
              Alert.alert(
                'Deletion Request Denied',
                res.error || 'Your organization deletion request could not be processed due to active listings or pending settlements.'
              );
              return;
            }
            await signOut();
            Alert.alert(
              'Account Deactivated',
              'Your organization account has been deactivated and queued for permanent data purge in 30 days.'
            );
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
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 14,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text
          style={[
            typography.h2,
            {
              color: colors.textPrimary,
              fontWeight: '700',
              letterSpacing: -0.5,
            },
          ]}
        >
          Organization Profile
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
          Business credentials, GSTIN registration and account settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {loading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ marginTop: 8, color: colors.textMuted }}>Loading organization…</Text>
          </View>
        ) : !userId ? (
          <>
            {/* Guest Organizer Card */}
            <Card variant="elevated">
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: radii.md,
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
                  Guest Organizer
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 280, lineHeight: 18 }}>
                  Sign in with your organization account to manage business credentials, submit GSTIN for verified invoices, and configure billing profiles.
                </Text>
                <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
                  <Button
                    title="Sign In as Organizer"
                    variant="primary"
                    size="md"
                    onPress={() => router.push('/auth/login?redirect=/(tabs)/profile' as any)}
                  />
                </View>
              </View>
            </Card>
          </>
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
                      <Badge label="Verified Business Host" variant="success" size="sm" />
                    ) : organizerData?.verificationStatus === 'pending' ? (
                      <Badge label="Verification Under Review" variant="warning" size="sm" />
                    ) : organizerData?.verificationStatus === 'rejected' ? (
                      <Badge label="Verification Rejected" variant="danger" size="sm" />
                    ) : (
                      <Badge label="Unverified Host" variant="neutral" size="sm" />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {organizerData?.gstin ? `GSTIN: ${organizerData.gstin}` : 'GST registration pending'} • Mumbai
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                    ★ {organizerData?.rating && organizerData.rating > 0 ? `${organizerData.rating.toFixed(1)} Host Rating` : 'New Host (Unrated)'} • {organizerData?.totalEventsHosted ?? 0} Shifts Hosted
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: organizerData?.verificationStatus === 'verified' && organizerData?.gstin ? colors.success : organizerData?.gstin ? colors.warning : colors.textMuted }}>
                    {organizerData?.verificationStatus === 'verified' && organizerData?.gstin
                      ? 'Verified GST Registered'
                      : organizerData?.gstin
                      ? 'Submitted (Under Review)'
                      : 'Not Provided'}
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

              <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Edit Profile"
                  variant="primary"
                  size="sm"
                  onPress={handleOpenEdit}
                />
                <Button
                  title="View Invoices"
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

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Edit Organization Profile</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={{ fontSize: 15, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            {editError ? (
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.danger,
                  padding: spacing.md,
                  borderRadius: radii.sm,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 13 }}>{editError}</Text>
              </View>
            ) : null}

            <Input
              label="Organization / Business Legal Name"
              value={formBusinessName}
              onChangeText={setFormBusinessName}
              placeholder="e.g. Apex Events Pvt Ltd"
            />

            <Input
              label="Indian GSTIN (Optional)"
              value={formGstin}
              onChangeText={setFormGstin}
              placeholder="e.g. 27AABCA1234F1Z5"
              autoCapitalize="characters"
              maxLength={15}
            />

            <Input
              label="Billing / Registered Office Address"
              value={formBillingAddress}
              onChangeText={setFormBillingAddress}
              placeholder="e.g. Unit 402, Trade Centre, BKC, Mumbai 400051"
              multiline
              numberOfLines={2}
            />

            <Input
              label="Operational Contact Phone"
              value={formContactPhone}
              onChangeText={setFormContactPhone}
              placeholder="e.g. 9820198201"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                title={saving ? 'Saving...' : 'Save Organization Details'}
                variant="primary"
                size="lg"
                onPress={handleSaveProfile}
                disabled={saving}
              />
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
