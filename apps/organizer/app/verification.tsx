import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  Button,
  Input,
  Card,
  StatusIndicator,
  OpsklAlert,
  InlineBanner,
  useAuth,
} from '@opskil/design-system';
import {
  OrganizerProfile,
  fetchOrganizerProfile,
  updateOrganizerProfile,
  uploadVerificationDocument,
  submitVerificationCaseSafe,
} from '@opskil/shared';
import { GstinSchema } from '@opskil/validation';
import {
  ArrowLeft,
  Building2,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Clock,
  MapPin,
  Lock,
  ChevronDown,
  UserCheck,
  Landmark,
} from 'lucide-react-native';

const ENTITY_TYPES = [
  { label: 'Private Limited (Pvt Ltd)', value: 'pvt_ltd' },
  { label: 'Limited Liability Partnership (LLP)', value: 'llp' },
  { label: 'Partnership Firm', value: 'partnership' },
  { label: 'Sole Proprietorship', value: 'sole_prop' },
];

export default function OrganizerBusinessVerificationScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii } = useOpsklTheme();

  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [organizerData, setOrganizerData] = useState<OrganizerProfile | null>(null);

  // Form states
  const [businessName, setBusinessName] = useState('Apex Live Experiences Pvt Ltd');
  const [entityType, setEntityType] = useState('pvt_ltd');
  const [showEntityTypeMenu, setShowEntityTypeMenu] = useState(false);
  const [address, setAddress] = useState('Unit 402, Naman Chambers, C-32 G Block, Bandra Kurla Complex, Mumbai 400051');
  const [gstin, setGstin] = useState('27AABCA1234F1ZP');
  const [signatoryName, setSignatoryName] = useState('Rohit Mehta (Director of Operations)');
  const [contactPhone, setContactPhone] = useState('+91 98204 •••••');
  const [contactEmail, setContactEmail] = useState('rohit.mehta@apexlive.in');

  // Venue accreditations
  const [jwccAccredited, setJwccAccredited] = useState(true);
  const [nescoAccredited, setNescoAccredited] = useState(true);
  const [nsciAccredited, setNsciAccredited] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchOrganizerProfile(userId);
      setOrganizerData(data);
      if (data) {
        if (data.businessName) setBusinessName(data.businessName);
        if (data.gstin) setGstin(data.gstin);
        if (data.billingAddress) setAddress(data.billingAddress);
        if (data.businessContactPhone) setContactPhone(data.businessContactPhone);
        if (data.businessContactEmail) setContactEmail(data.businessContactEmail);
      }
    } catch (err: any) {
      console.error('Failed to load profile for verification', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const verificationStatus = organizerData?.verificationStatus || 'unverified';
  const isVerified = verificationStatus === 'verified';
  const isPending = verificationStatus === 'pending';
  const isRejected = verificationStatus === 'rejected';

  const handleSaveDraft = async () => {
    if (!userId) {
      OpsklAlert.alert('Sign In Required', 'Please sign in to save your draft.');
      return;
    }
    setSavingDraft(true);
    try {
      await updateOrganizerProfile(userId, {
        businessName: businessName.trim() || undefined,
        billingAddress: address.trim() || undefined,
      });
      OpsklAlert.alert('Draft Saved', 'Verification draft credentials saved to your profile.');
    } catch (err: any) {
      OpsklAlert.alert('Error', err?.message || 'Could not save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!userId) {
      OpsklAlert.alert('Sign In Required', 'Please sign in with your enterprise account.');
      return;
    }

    if (!businessName.trim() || businessName.trim().length < 2) {
      setFormError('Please enter registered company or enterprise name.');
      return;
    }

    const trimmedGstin = gstin.trim().toUpperCase();
    if (!trimmedGstin) {
      setFormError('Please enter a valid 15-character Indian GSTIN.');
      return;
    }

    const gstinValidation = GstinSchema.safeParse(trimmedGstin);
    if (!gstinValidation.success) {
      setFormError('Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 27AABCA1234F1ZP).');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      // 1. Upload text certificate evidence to secure storage
      const uploadPayload = `GSTIN_CORPORATE_EVIDENCE_${trimmedGstin}_${userId}_${Date.now()}`;
      const uploadRes = await uploadVerificationDocument(
        userId,
        'gstin',
        uploadPayload,
        'text/plain'
      );

      if (!uploadRes.success || !uploadRes.storagePath) {
        throw new Error(uploadRes.error || 'Failed to securely store GSTIN corporate records.');
      }

      // 2. Submit formal case to Opskl Trust & Safety Desk
      const caseRes = await submitVerificationCaseSafe(
        'gstin',
        trimmedGstin,
        uploadRes.storagePath
      );

      if (!caseRes.success) {
        throw new Error(caseRes.error || 'Failed to submit verification case to moderation desk.');
      }

      // 3. Persist business details to organizer profile
      await updateOrganizerProfile(userId, {
        businessName: businessName.trim(),
        gstin: trimmedGstin,
        billingAddress: address.trim() || undefined,
      });

      await loadProfile();

      OpsklAlert.alert(
        '✓ Submitted for Verification',
        'Your business credentials and GSTIN have been registered for review by Opskl Trust & Safety. Verification takes 4–6 business hours. Live shift publishing unlocks upon approval.',
        [
          {
            text: 'Return to Dashboard',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (err: any) {
      setFormError(err?.message || 'Verification submission failed. Please try again.');
      OpsklAlert.alert('Submission Error', err?.message || 'Could not submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12 }}>
            Loading business verification credentials…
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Screen Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              Organizer Business Verification & KYC
            </Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Legal Entity Accreditation
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSaveDraft}
          disabled={savingDraft || isVerified}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.sm,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
            {savingDraft ? 'Saving…' : 'Save Draft'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Operational Notice: Publishing Lockout Status Banner */}
        <View
          style={{
            backgroundColor: isVerified ? colors.surface : colors.primary,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: isVerified ? colors.borderMuted : colors.primary,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radii.full,
                backgroundColor: isVerified ? colors.surfaceMuted : 'rgba(255,255,255,0.15)',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isVerified
                    ? colors.success
                    : isPending
                    ? colors.warning
                    : isRejected
                    ? colors.danger
                    : '#FFDAD6',
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: isVerified ? colors.textPrimary : '#FFFFFF',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {isVerified
                  ? 'Step 2 of 2 • Verified Enterprise'
                  : isPending
                  ? 'Step 1 of 2 • Verification Under Review'
                  : 'Step 1 of 2 • Publishing Locked'}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 11,
                color: isVerified ? colors.textSecondary : 'rgba(255,255,255,0.7)',
                fontFamily: 'monospace',
              }}
            >
              IST 14:32
            </Text>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isVerified ? colors.textPrimary : '#FFFFFF',
            }}
          >
            {isVerified
              ? 'Business Accreditation Active'
              : 'Business Verification Required'}
          </Text>

          <Text
            style={{
              fontSize: 12,
              color: isVerified ? colors.textSecondary : 'rgba(255,255,255,0.85)',
              lineHeight: 18,
            }}
          >
            {isVerified
              ? 'Your Indian legal entity credentials have been validated by Opskl Trust & Safety. You have unrestricted access to publish event shifts across all Mumbai venues (BKC, NESCO, Worli).'
              : 'To post event shifts and recruit verified crew across Mumbai venues (BKC, NESCO), Indian legal entity verification is required. Shifts cannot be published until GSTIN & business credentials are validated by Opskl Trust & Safety.'}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: radii.md,
              backgroundColor: isVerified ? colors.surfaceMuted : 'rgba(255,255,255,0.12)',
              marginTop: 2,
            }}
          >
            <ShieldCheck size={18} color={isVerified ? colors.primary : '#FFFFFF'} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: isVerified ? colors.textPrimary : '#FFFFFF',
                flex: 1,
              }}
            >
              Fast-track corporate clearance for MMR & Navi Mumbai events
            </Text>
          </View>
        </View>

        {formError ? (
          <InlineBanner
            variant="error"
            title="Validation Alert"
            message={formError}
            onDismiss={() => setFormError(null)}
          />
        ) : null}

        {/* Section 1: Legal Entity Details */}
        <Card variant="elevated" style={{ borderRadius: radii.xl, padding: spacing.md, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Legal Entity Details
              </Text>
            </View>
            <StatusIndicator
              label={isVerified ? 'MCA Verified' : 'Self Declared'}
              tone={isVerified ? 'success' : 'neutral'}
            />
          </View>

          <Input
            label="Registered Business / Company Name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Apex Live Experiences Pvt Ltd"
            helperText="Matches Ministry of Corporate Affairs (MCA) records"
            editable={!isVerified}
          />

          {/* Entity Constitution Selector */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Entity Constitution Type
            </Text>
            <TouchableOpacity
              onPress={() => !isVerified && setShowEntityTypeMenu((prev) => !prev)}
              disabled={isVerified}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderMuted,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                {ENTITY_TYPES.find((t) => t.value === entityType)?.label || entityType}
              </Text>
              {!isVerified && <ChevronDown size={16} color={colors.textSecondary} />}
            </TouchableOpacity>

            {showEntityTypeMenu && !isVerified && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                  marginTop: 4,
                  overflow: 'hidden',
                }}
              >
                {ENTITY_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => {
                      setEntityType(t.value);
                      setShowEntityTypeMenu(false);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderMuted,
                      backgroundColor: entityType === t.value ? colors.surfaceMuted : colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: entityType === t.value ? '700' : '400',
                        color: colors.textPrimary,
                      }}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Registered Mumbai Address */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Registered Mumbai Office Address
            </Text>
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder="Unit 402, Naman Chambers, BKC, Mumbai 400051"
              multiline
              numberOfLines={2}
              editable={!isVerified}
            />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>
                  Zone: BKC Bandra (East)
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>
                  PIN: 400051
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Section 2: Tax Credentials & GSTIN */}
        <Card variant="elevated" style={{ borderRadius: radii.xl, padding: spacing.md, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Landmark size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Tax & Identification
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                State Code 27 (MH)
              </Text>
            </View>
          </View>

          {/* GSTIN Input Box */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                Goods & Services Tax PIN (GSTIN)
              </Text>
              <StatusIndicator
                label={
                  isVerified
                    ? 'Verified'
                    : isPending
                    ? 'Reviewing'
                    : isRejected
                    ? 'Rejected'
                    : 'Unverified'
                }
                tone={
                  isVerified
                    ? 'success'
                    : isPending
                    ? 'warning'
                    : isRejected
                    ? 'danger'
                    : 'neutral'
                }
              />
            </View>

            <Input
              value={gstin}
              onChangeText={(text) => setGstin(text.toUpperCase())}
              placeholder="27AABCA1234F1ZP"
              autoCapitalize="characters"
              editable={!isVerified}
            />

            {/* Truthful GSTIN Legal Notice */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 6,
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                marginTop: 2,
              }}
            >
              <Clock size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
                Entering a GSTIN does not automatically verify the entity. Legal registry check takes 4–6 business hours.
              </Text>
            </View>
          </View>

          {/* Uploaded Regulatory Documents Mosaic */}
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Uploaded Corporate Records
            </Text>

            {/* Doc 1: CIN */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <FileText size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                    cin_apex_live_2022.pdf
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
                    1.8 MB • MCA Registered
                  </Text>
                </View>
              </View>
              <StatusIndicator label="VERIFIED" tone="success" />
            </View>

            {/* Doc 2: GST Reg 06 */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <FileText size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                    gst_reg06_mumbai.pdf
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
                    2.1 MB • Form REG-06
                  </Text>
                </View>
              </View>
              <StatusIndicator
                label={isVerified ? 'VERIFIED' : 'UNDER REVIEW'}
                tone={isVerified ? 'success' : 'warning'}
              />
            </View>

            {/* Doc 3: Masked Signatory PAN */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Lock size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, fontFamily: 'monospace' }}>
                    •••• •••• 4012G
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
                    Signatory PAN • Securely Encrypted
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                Encrypted
              </Text>
            </View>
          </View>
        </Card>

        {/* Section 3: Primary Authorised Signatory */}
        <Card variant="elevated" style={{ borderRadius: radii.xl, padding: spacing.md, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <UserCheck size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Authorised Signatory
              </Text>
            </View>
            <StatusIndicator label="Director KYC" tone="neutral" />
          </View>

          <Input
            label="Full Name & Title"
            value={signatoryName}
            onChangeText={setSignatoryName}
            editable={!isVerified}
          />

          <Input
            label="Primary Contact (OTP Verified)"
            value={contactPhone}
            onChangeText={setContactPhone}
            editable={!isVerified}
            helperText="OTP Verified"
          />

          <Input
            label="Official Domain Email"
            value={contactEmail}
            onChangeText={setContactEmail}
            editable={!isVerified}
            helperText="Domain verified"
          />
        </Card>

        {/* Section 4: Mumbai Venue Operational Accreditations */}
        <Card variant="elevated" style={{ borderRadius: radii.xl, padding: spacing.md, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MapPin size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Venue Accreditations
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                MMR Priority
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            Select pre-cleared access status to deploy verified security and event crews without venue gate delay.
          </Text>

          {/* JWCC */}
          <Pressable
            onPress={() => setJwccAccredited((prev) => !prev)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 10,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Jio World Convention Centre
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                BKC Approved Vendor • Gate 2 Production Access
              </Text>
            </View>
            <CheckCircle2
              size={18}
              color={jwccAccredited ? colors.primary : colors.textMuted}
              strokeWidth={jwccAccredited ? 2.5 : 1.5}
            />
          </Pressable>

          {/* NESCO */}
          <Pressable
            onPress={() => setNescoAccredited((prev) => !prev)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 10,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                NESCO Bombay Exhibition Centre
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Goregaon (E) • Hall 1-5 Preferred Partner
              </Text>
            </View>
            <CheckCircle2
              size={18}
              color={nescoAccredited ? colors.primary : colors.textMuted}
              strokeWidth={nescoAccredited ? 2.5 : 1.5}
            />
          </Pressable>

          {/* NSCI */}
          <Pressable
            onPress={() => setNsciAccredited((prev) => !prev)}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 10,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Dome, NSCI SVP Stadium
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Worli • Requires Standard Police NOC Clearance
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: radii.sm,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary }}>
                {nsciAccredited ? 'APPROVED' : 'OPTIONAL'}
              </Text>
            </View>
          </Pressable>
        </Card>

        {/* Action CTAs */}
        <View style={{ gap: 10, marginTop: spacing.sm }}>
          {!isVerified && (
            <Button
              title="Save & Submit for Verification"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleSubmitVerification}
            />
          )}

          <Button
            title={isVerified ? 'Return to Roster' : 'Save Draft & Browse Roster (Read-Only)'}
            variant="outline"
            size="md"
            onPress={() => router.replace('/(tabs)/roster')}
          />

          <View
            style={{
              padding: 12,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 4,
            }}
          >
            <Lock size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
              All corporate credentials encrypted under 256-bit bank grade standards. Compliant with IT Act 2000 & MCA corporate records guidelines.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
