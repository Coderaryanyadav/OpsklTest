import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Linking, Modal, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useOpsklTheme,
  Button,
  Badge,
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
  supabase,
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
  const [pickedGstinDoc, setPickedGstinDoc] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const userId = session?.user?.id;

  const handlePickGstinDoc = () => {
    OpsklAlert.alert(
      'Attach GST Certificate',
      'Upload your official Form GST REG-06 registration certificate:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                OpsklAlert.alert('Permission Denied', 'Camera permission is required to photograph your GST certificate.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.85,
              });
              if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setPickedGstinDoc({
                  uri: asset.uri,
                  name: asset.fileName || 'gst_certificate.jpg',
                  mimeType: asset.mimeType || 'image/jpeg',
                });
                setGstinAcknowledged(true);
              }
            } catch (err: any) {
              OpsklAlert.alert('Camera Error', err?.message || 'Failed to capture photo.');
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                OpsklAlert.alert('Permission Denied', 'Photo library permission is required to select document photos.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.85,
              });
              if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setPickedGstinDoc({
                  uri: asset.uri,
                  name: asset.fileName || 'gst_certificate.jpg',
                  mimeType: asset.mimeType || 'image/jpeg',
                });
                setGstinAcknowledged(true);
              }
            } catch (err: any) {
              OpsklAlert.alert('Gallery Error', err?.message || 'Failed to pick image.');
            }
          },
        },
        {
          text: 'Upload PDF Certificate',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setPickedGstinDoc({
                  uri: asset.uri,
                  name: asset.name,
                  mimeType: asset.mimeType || 'application/pdf',
                });
                setGstinAcknowledged(true);
              }
            } catch (err: any) {
              OpsklAlert.alert('Document Error', err?.message || 'Failed to pick document.');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

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

  // Realtime subscription to live GSTIN / KYC / organizer profile verification updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`organizer_profile_rt_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organizer_profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          loadProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadProfile]);

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
        const uploadData = pickedGstinDoc
          ? { uri: pickedGstinDoc.uri }
          : `GSTIN_TEXT_SUBMISSION_${trimmedGstin}_${userId}_${Date.now()}`;
        const contentType = pickedGstinDoc ? pickedGstinDoc.mimeType : 'text/plain';

        const uploadRes = await uploadVerificationDocument(
          userId,
          'gstin',
          uploadData,
          contentType
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
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md, paddingBottom: 120 }}
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

              {/* Publishing Verification Status Card */}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  gap: spacing.xs,
                  borderWidth: 1,
                  borderColor: organizerData?.verificationStatus === 'verified' ? colors.border : '#F59E0B',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View
                    style={{
                      backgroundColor: organizerData?.verificationStatus === 'verified' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radii.full,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: radii.full,
                        backgroundColor: organizerData?.verificationStatus === 'verified' ? colors.success : '#F59E0B',
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: organizerData?.verificationStatus === 'verified' ? colors.success : '#F59E0B',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {organizerData?.verificationStatus === 'verified'
                        ? 'Publishing Unlocked • Verified Host'
                        : 'Action Required • Publishing Locked'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: colors.textSecondary,
                    }}
                  >
                    IST (UTC +5:30)
                  </Text>
                </View>

                <Text
                  style={[
                    typography.h3,
                    {
                      color: colors.textPrimary,
                      marginTop: 2,
                    },
                  ]}
                >
                  {organizerData?.verificationStatus === 'verified'
                    ? 'Corporate Entity Clearance Active'
                    : 'Business Verification Required'}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    lineHeight: 18,
                  }}
                >
                  {organizerData?.verificationStatus === 'verified'
                    ? 'Your organization is authorized to publish event shifts and recruit verified crew across BKC, NESCO, and South Mumbai venues.'
                    : 'To post event shifts across premier Mumbai venues (BKC, NESCO), Indian business verification is required. Shifts cannot be published until GSTIN & business credentials are validated.'}
                </Text>

                <TouchableOpacity
                  onPress={() => router.push('/verification' as any)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginTop: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {organizerData?.verificationStatus === 'verified'
                      ? 'View Corporate Verification Credentials'
                      : 'Open Verification & KYC Console'} ➔
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Section: Legal Entity Details */}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                  backgroundColor: colors.surface,
                  gap: spacing.md,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[typography.h3, { color: colors.textPrimary }]}>
                    Legal Entity Details
                  </Text>
                  <Badge label="MCA COMPLIANT" variant="neutral" size="sm" />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Registered Business Name
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: spacing.sm + 2,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {businessName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Matches Ministry of Corporate Affairs records
                    </Text>
                  </View>
                </View>

                {organizerData?.billingAddress ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Registered Mumbai Address
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: radii.md,
                        padding: spacing.sm + 2,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 18 }}>
                        {organizerData.billingAddress}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
                            Zone: {organizerData.billingAddress.includes('BKC') ? 'BKC Hub' : organizerData.billingAddress.includes('Worli') ? 'Worli Hub' : organizerData.billingAddress.includes('Goregaon') ? 'NESCO Hub' : 'Mumbai Region'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Section: Tax Credentials & GSTIN */}
                <View style={{ gap: 4, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Goods & Services Tax PIN (GSTIN)
                    </Text>
                    <Badge label="State Code 27 (MH)" variant="neutral" size="sm" />
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: spacing.sm + 2,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.5 }}>
                        {organizerData?.gstin || 'No GSTIN Registered'}
                      </Text>
                      <StatusIndicator
                        label={
                          organizerData?.verificationStatus === 'verified' && organizerData?.gstin
                            ? 'Verified'
                            : organizerData?.gstin
                            ? 'Pending Admin Review'
                            : 'Unregistered'
                        }
                        tone={
                          organizerData?.verificationStatus === 'verified' && organizerData?.gstin
                            ? 'success'
                            : organizerData?.gstin
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                      Entering a GSTIN does not automatically verify the entity. Legal registry check takes 4–6 business hours.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.xs }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Contact Phone</Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                    {organizerData?.businessContactPhone || userProfile?.phone || '—'}
                  </Text>
                </View>

                <Divider />

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Edit Profile & Documents" variant="primary" size="sm" onPress={handleOpenEdit} />
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
                />
            </FormField>

            <DocumentUpload
              label="GST Registration Certificate (PDF / Photo)"
              fileName={
                pickedGstinDoc
                  ? pickedGstinDoc.name
                  : formGstin.trim().length === 15
                  ? `GSTIN ${formGstin.trim().toUpperCase()} (Tap to attach certificate)`
                  : null
              }
              helperText="Attach a scanned copy or clear photo of your Form GST REG-06 registration certificate."
              onPick={handlePickGstinDoc}
              onClear={
                pickedGstinDoc
                  ? () => setPickedGstinDoc(null)
                  : gstinAcknowledged
                  ? () => setGstinAcknowledged(false)
                  : undefined
              }
            />

            {pickedGstinDoc ? (
              <InlineBanner
                variant="info"
                title="Document Certificate Ready"
                message={`File "${pickedGstinDoc.name}" will be uploaded securely to private verification storage upon saving.`}
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
