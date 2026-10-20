import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Linking, Modal, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Button,
  Input,
  useAuth,
  Screen,
  ScreenHeader,
  ErrorRetry,
  EmptyState,
  StatusIndicator,
  FormField,
  DocumentUpload,
  InlineBanner,
  Toggle,
  KeyboardAwareContainer,
  LoadingView,
  OpsklAlert,
  Divider,
} from '@opskil/design-system';
import {
  fetchOrganizerProfile,
  updateOrganizerProfile,
  OrganizerProfile,
  requestAccountDeletionSafe,
  submitVerificationCaseSafe,
  uploadVerificationDocument,
} from '@opskil/shared';
import { GstinSchema } from '@opskil/validation';
import { Building2 } from 'lucide-react-native';

export default function OrganizerProfileScreen() {
  const router = useRouter();
  const { session, userProfile, signOut } = useAuth();
  const { colors, spacing, radii, typography, isDark, toggleTheme } = useOpsklTheme();

  const [organizerData, setOrganizerData] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formBusinessName, setFormBusinessName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [gstinAcknowledged, setGstinAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const data = await fetchOrganizerProfile(userId);
      setOrganizerData(data);
    } catch (err: any) {
      console.error('Failed to load organizer profile', err);
      setLoadError(err?.message || 'Could not load organization profile.');
      setOrganizerData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleOpenEdit = () => {
    setFormBusinessName(organizerData?.businessName || userProfile?.fullName || '');
    setFormGstin(organizerData?.gstin || '');
    setFormBillingAddress(organizerData?.billingAddress || '');
    setFormContactPhone(organizerData?.businessContactPhone || userProfile?.phone || '');
    setGstinAcknowledged(false);
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
    const gstinChanged =
      !!trimmedGstin && trimmedGstin !== (organizerData?.gstin || '').toUpperCase();
    // Resubmit when GSTIN is present but no active review exists (covers partial-failure stuck state:
    // profile GSTIN saved, upload/case failed, later saves skipped because gstinChanged was false).
    const verificationStatus = organizerData?.verificationStatus;
    const gstinNeedsCase =
      !!trimmedGstin &&
      (gstinChanged ||
        (verificationStatus !== 'verified' && verificationStatus !== 'pending'));

    if (trimmedGstin) {
      const gstinResult = GstinSchema.safeParse(trimmedGstin);
      if (!gstinResult.success) {
        setEditError('Please enter a valid 15-character Indian GSTIN (e.g. 27AABCA1234F1Z5)');
        return;
      }
      if (gstinNeedsCase && !gstinAcknowledged) {
        setEditError('Confirm GSTIN text submission below. Gallery PDF upload is not enabled in this build.');
        return;
      }
    }
    setSaving(true);
    setEditError(null);
    try {
      // Submit KYC evidence BEFORE persisting GSTIN on the profile so a storage/RPC failure
      // cannot leave an organizer with a saved GSTIN and no admin review case.
      if (gstinNeedsCase && trimmedGstin) {
        const certificateBlob = `GSTIN_TEXT_SUBMISSION_${trimmedGstin}_${userId}_${Date.now()}`;
        const uploadRes = await uploadVerificationDocument(
          userId,
          'gstin',
          certificateBlob,
          'text/plain'
        );

        if (!uploadRes.success || !uploadRes.storagePath) {
          throw new Error(uploadRes.error || 'Failed to submit GSTIN text evidence for review.');
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

      await updateOrganizerProfile(userId, {
        businessName: formBusinessName.trim(),
        gstin: trimmedGstin || undefined,
        billingAddress: formBillingAddress.trim() || undefined,
        contactPhone: formContactPhone.trim() || undefined,
        profileCompletionStatus: 'completed',
      });

      const updated = await fetchOrganizerProfile(userId);
      setOrganizerData(updated);
      setEditModalVisible(false);
      OpsklAlert.alert(
        'Profile Updated',
        gstinNeedsCase
          ? 'Organization details saved. GSTIN was submitted as text for admin review (no PDF file attached).'
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
        OpsklAlert.alert('Unable to open link', `Please visit ${url} in your browser.`);
      }
    } catch {
      OpsklAlert.alert('Notice', `Please visit ${url}`);
    }
  };

  const handleSignOut = async () => {
    OpsklAlert.alert('Sign Out', 'Are you sure you want to sign out of your Organizer account?', [
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
    OpsklAlert.alert(
      'Delete Organization Account',
      'Are you sure you want to permanently delete your Opskl organizer account? Active listings and billing history will be queued for archival.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const res = await requestAccountDeletionSafe(
              userId,
              'Organizer requested in-app account deletion'
            );
            if (!res.success) {
              OpsklAlert.alert(
                'Deletion Request Denied',
                res.error ||
                  'Your organization deletion request could not be processed due to active listings or pending settlements.'
              );
              return;
            }
            await signOut();
            OpsklAlert.alert(
              'Account Deactivated',
              'Your organization account has been deactivated and queued for permanent data purge in 30 days.'
            );
          },
        },
      ]
    );
  };

  const businessName = organizerData?.businessName || userProfile?.fullName || 'Event Host Organization';
  const initials =
    businessName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'OP';

  const verificationTone = (): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (organizerData?.verificationStatus) {
      case 'verified':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Organization Profile"
        subtitle="Business credentials, GSTIN registration and account settings"
      />

      {loading ? (
        <LoadingView message="Loading organization…" />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadProfile();
              }}
            />
          }
        >
          {loadError ? (
            <ErrorRetry
              variant="block"
              title="Profile unavailable"
              message={loadError}
              onRetry={loadProfile}
            />
          ) : !userId ? (
            <EmptyState
              icon={<Building2 size={28} color={colors.textMuted} strokeWidth={2} />}
              title="Guest Organizer"
              description="Sign in to manage business credentials, submit GSTIN for verified invoices, and configure billing."
              actionLabel="Sign In as Organizer"
              onAction={() => router.push('/auth/login?redirect=/(tabs)/profile' as any)}
            />
          ) : (
            <>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  backgroundColor: colors.surface,
                }}
              >
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
                    <Text style={{ fontSize: 22, color: colors.textInverse, fontWeight: '800' }}>
                      {initials}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
                        {businessName}
                      </Text>
                      <StatusIndicator
                        label={
                          organizerData?.verificationStatus === 'verified'
                            ? 'Verified host'
                            : organizerData?.verificationStatus === 'pending'
                              ? 'Under review'
                              : organizerData?.verificationStatus === 'rejected'
                                ? 'Rejected'
                                : 'Unverified'
                        }
                        tone={verificationTone()}
                        size="sm"
                      />
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                      {organizerData?.gstin
                        ? `GSTIN: ${organizerData.gstin}`
                        : 'GST registration pending'}{' '}
                      • Mumbai
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {organizerData?.rating && organizerData.rating > 0
                        ? `Host rating ${organizerData.rating.toFixed(1)}`
                        : 'New host (unrated)'}{' '}
                      • {organizerData?.totalEventsHosted ?? 0} shifts hosted
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  backgroundColor: colors.surface,
                  gap: spacing.sm,
                }}
              >
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                  Billing & Tax Compliance
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Tax invoices and input tax credits (ITC) are generated under this profile.
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>GSTIN status</Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color:
                        organizerData?.verificationStatus === 'verified' && organizerData?.gstin
                          ? colors.success
                          : organizerData?.gstin
                            ? colors.warning
                            : colors.textMuted,
                    }}
                  >
                    {organizerData?.verificationStatus === 'verified' && organizerData?.gstin
                      ? 'Verified GST registered'
                      : organizerData?.gstin
                        ? 'Submitted (under review)'
                        : 'Not provided'}
                  </Text>
                </View>

                {organizerData?.billingAddress ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Billing address</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textPrimary,
                        flex: 1,
                        textAlign: 'right',
                        marginLeft: 16,
                      }}
                      numberOfLines={3}
                    >
                      {organizerData.billingAddress}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Contact phone</Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '500' }}>
                    {organizerData?.businessContactPhone || userProfile?.phone || '—'}
                  </Text>
                </View>

                <Divider />

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Edit Profile" variant="primary" size="sm" onPress={handleOpenEdit} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="View Invoices"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push('/(tabs)/finances')}
                    />
                  </View>
                </View>
              </View>

              <Toggle
                label="Dark Mode"
                description="Low-light venue production booths"
                value={isDark}
                onValueChange={toggleTheme}
              />

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  backgroundColor: colors.surface,
                  gap: spacing.sm,
                }}
              >
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Support & Legal</Text>
                <Button
                  title="Organizer Terms of Service"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleOpenUrl('https://opskil.com/terms')}
                />
                <Button
                  title="Privacy & Data Security Policy"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleOpenUrl('https://opskil.com/privacy')}
                />
                <Button
                  title="Organizer Support"
                  variant="ghost"
                  size="sm"
                  onPress={() => handleOpenUrl('mailto:organizer-support@opskil.com')}
                />
              </View>

              <View style={{ gap: spacing.sm }}>
                <Button title="Sign Out" variant="outline" size="md" onPress={handleSignOut} />
                <Button
                  title="Request Organization Deletion"
                  variant="danger"
                  size="md"
                  onPress={handleDeleteAccount}
                />
              </View>

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
      )}

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)} accessibilityViewIsModal
      >
        <Screen edges={['top', 'bottom']}>
          <ScreenHeader
            title="Edit Organization Profile"
            onBack={() => setEditModalVisible(false)}
          />

          <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
            {editError ? (
              <InlineBanner variant="error" message={editError} />
            ) : null}

            <FormField label="Organization / Business Legal Name">
              <Input
                value={formBusinessName}
                onChangeText={setFormBusinessName}
                placeholder="e.g. Apex Events Pvt Ltd"
              />
            </FormField>

            <FormField
              label="Indian GSTIN (Optional)"
              helperText="15-character GSTIN. Gallery / camera PDF pick is not enabled in this build."
            >
              <Input
                value={formGstin}
                onChangeText={setFormGstin}
                placeholder="e.g. 27AABCA1234F1Z5"
                autoCapitalize="characters"
                maxLength={15}
              />
            </FormField>

            <DocumentUpload
              label="GSTIN text submission"
              fileName={
                formGstin.trim().length === 15
                  ? `GSTIN ${formGstin.trim().toUpperCase()} (text only)`
                  : null
              }
              helperText="No gallery file is attached. Saving submits the GSTIN number above as text for admin review — same honesty pattern as worker KYC."
              onPick={() => {
                if (formGstin.trim().length !== 15) {
                  OpsklAlert.alert(
                    'Enter GSTIN first',
                    'Type a valid 15-character GSTIN above, then acknowledge text submission.'
                  );
                  return;
                }
                setGstinAcknowledged(true);
                OpsklAlert.alert(
                  'GSTIN text ready',
                  'No PDF will be uploaded. The GSTIN number will be submitted as text evidence for admin review.'
                );
              }}
              onClear={
                gstinAcknowledged
                  ? () => {
                      setGstinAcknowledged(false);
                    }
                  : undefined
              }
            />

            {gstinAcknowledged && formGstin.trim().length === 15 ? (
              <InlineBanner
                variant="info"
                title="Text submission acknowledged"
                message="Admin will review the GSTIN number. A scanned certificate PDF cannot be attached from this screen."
              />
            ) : null}

            <FormField label="Billing / Registered Office Address">
              <Input
                value={formBillingAddress}
                onChangeText={setFormBillingAddress}
                placeholder="e.g. Unit 402, Trade Centre, BKC, Mumbai 400051"
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Operational Contact Phone">
              <Input
                value={formContactPhone}
                onChangeText={setFormContactPhone}
                placeholder="e.g. 9820198201"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </FormField>

            <Button
              title={saving ? 'Saving…' : 'Save Organization Details'}
              variant="primary"
              size="lg"
              onPress={handleSaveProfile}
              disabled={saving}
              loading={saving}
            />
            <Button
              title="Cancel"
              variant="outline"
              size="md"
              onPress={() => setEditModalVisible(false)}
              disabled={saving}
            />
          </KeyboardAwareContainer>
        </Screen>
      </Modal>
    </Screen>
  );
}
