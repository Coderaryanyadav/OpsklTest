import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useOpsklTheme,
  Screen,
  ScreenHeader,
  Input,
  Button,
  Badge,
  EmptyState,
  KeyboardAwareContainer,
  useAuth,
  FormField,
  LoadingView,
  OpsklAlert,
} from '@opskil/design-system';
import {
  updateWorkerProfile,
  updateUserProfile,
  fetchWorkerProfile,
  fetchUserProfile,
  fetchLatestVerificationCase,
  submitVerificationCaseSafe,
  uploadVerificationDocument,
  isValidIndianUpiId,
  VerificationCase,
} from '@opskil/shared';
import {
  Shield,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Sparkles,
  Check,
  Plus,
  HelpCircle,
  CreditCard,
  Calendar,
} from 'lucide-react-native';

const LOCALITY_OPTIONS = [
  { id: 'bkc', label: 'Bandra Kurla Complex (BKC) & Western Suburbs', sublabel: 'Covers Jio World Centre, Grand Hyatt & nearby 5★ zones' },
  { id: 'nesco', label: 'NESCO / Goregaon & North Mumbai', sublabel: 'Covers Bombay Exhibition Centre & Western Express Highway' },
  { id: 'town', label: 'Lower Parel / South Mumbai (Town)', sublabel: 'Covers St. Regis, NSCI Dome & luxury lifestyle venues' },
  { id: 'andheri', label: 'Andheri East & MIDC Hub', sublabel: 'Covers Airport hotels, The Leela & corporate banquet centers' },
  { id: 'navi_mumbai', label: 'Navi Mumbai & Vashi CIDCO Center', sublabel: 'Covers CIDCO Exhibition Centre & Belapur CBD' },
  { id: 'thane', label: 'Thane & Central Corridor', sublabel: 'Covers Central Suburbs & Eastern Express Highway venues' },
];

const AVAILABLE_ROLES = [
  'Guest Relations / Hospitality',
  'Registration & Badge Desk',
  'Venue Ops & Logistics',
  'VIP Ushering',
  'Food & Beverage Steward',
  'AV / Production Assist',
  'Backstage Coordinator',
];

const AVAILABLE_LANGUAGES = [
  'English (Professional)',
  'Hindi (Fluent)',
  'Marathi (Conversational)',
  'Gujarati (Conversational)',
];

type WorkerDocType = 'aadhaar' | 'pan';

export default function WorkerOnboardingScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { session, refreshProfile } = useAuth();
  const { colors, spacing, typography, borders } = useOpsklTheme();

  const userId = session?.user?.id;

  // Wizard Step: 1 = Profile & Work Preferences, 2 = KYC & Masked Compliance
  const [step, setStep] = useState<1 | 2>(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Profile & Skills Fields
  const [legalName, setLegalName] = useState('');
  const [selectedLocality, setSelectedLocality] = useState('bkc');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    'Guest Relations / Hospitality',
    'Registration & Badge Desk',
  ]);
  const [weekendSurgeEnabled, setWeekendSurgeEnabled] = useState(true);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([
    'English (Professional)',
    'Hindi (Fluent)',
  ]);
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // Step 2: KYC & Compliance Fields
  const [docType, setDocType] = useState<WorkerDocType>('aadhaar');
  const [rawDocNumber, setRawDocNumber] = useState('');
  const [frontDoc, setFrontDoc] = useState<{ uri: string; name: string; mimeType: string; size?: string } | null>(null);
  const [backDoc, setBackDoc] = useState<{ uri: string; name: string; mimeType: string; size?: string } | null>(null);
  const [upiId, setUpiId] = useState('');
  const [agreedToTerms] = useState(true);
  const [existingCase, setExistingCase] = useState<VerificationCase | null>(null);
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Contextual Permission Modal
  const [permissionTarget, setPermissionTarget] = useState<'front' | 'back' | null>(null);

  // Load existing profile & verification case
  useEffect(() => {
    async function loadData() {
      if (!userId) {
        setLoadingInitial(false);
        return;
      }
      try {
        const [uProfile, wProfile, vCase] = await Promise.all([
          fetchUserProfile(userId),
          fetchWorkerProfile(userId),
          fetchLatestVerificationCase(userId),
        ]);

        if (uProfile?.fullName) setLegalName(uProfile.fullName);

        if (wProfile) {
          if (wProfile.skills?.length) setSelectedRoles(wProfile.skills);
          if (wProfile.preferredLocality) {
            const matched = LOCALITY_OPTIONS.find(
              (l) => l.id === wProfile.preferredLocality || l.label.includes(wProfile.preferredLocality || '')
            );
            if (matched) setSelectedLocality(matched.id);
          }
          if (wProfile.upiId) setUpiId(wProfile.upiId);

          if (wProfile.bio) {
            try {
              const meta = JSON.parse(wProfile.bio);
              if (meta.weekendSurge !== undefined) setWeekendSurgeEnabled(meta.weekendSurge);
              if (meta.languages?.length) setSelectedLanguages(meta.languages);
            } catch {
              // plain bio
            }
          }
        }

        if (vCase) {
          setExistingCase(vCase);
          if (vCase.documentType === 'aadhaar' || vCase.documentType === 'pan') {
            setDocType(vCase.documentType);
          }
          // If profile is already filled and case exists, jump to step 2 to view status
          if (wProfile?.profileCompletionStatus === 'completed') {
            setStep(2);
          }
        }
      } catch (err) {
        console.warn('Failed to load existing worker onboarding data', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [userId]);

  // Contextual Document Picker
  const triggerDocumentPicker = async (type: 'camera' | 'gallery' | 'pdf') => {
    const targetSlot = permissionTarget;
    setPermissionTarget(null);
    if (!targetSlot) return;

    try {
      if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          OpsklAlert.alert('Camera Permission Required', 'Camera access is needed to capture identity proof.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const docObj = {
            uri: asset.uri,
            name: `${docType}_${targetSlot}_side.jpg`,
            mimeType: 'image/jpeg',
            size: '1.2 MB',
          };
          if (targetSlot === 'front') setFrontDoc(docObj);
          else setBackDoc(docObj);
        }
      } else if (type === 'gallery') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          OpsklAlert.alert('Gallery Permission Required', 'Photo library access is needed to select document images.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const docObj = {
            uri: asset.uri,
            name: asset.fileName || `${docType}_${targetSlot}_side.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
            size: '950 KB',
          };
          if (targetSlot === 'front') setFrontDoc(docObj);
          else setBackDoc(docObj);
        }
      } else if (type === 'pdf') {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets[0]) {
          const asset = result.assets[0];
          const docObj = {
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType || 'application/pdf',
            size: asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : '1.4 MB',
          };
          if (targetSlot === 'front') setFrontDoc(docObj);
          else setBackDoc(docObj);
        }
      }
    } catch (err: any) {
      OpsklAlert.alert('Upload Error', err?.message || 'Failed to capture or attach document.');
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (legalName.trim().length < 3) {
      errors.legalName = 'Full legal name (at least 3 characters) matching your government ID is required.';
    }
    if (selectedRoles.length < 2) {
      errors.roles = 'Please select at least 2 event roles to enable shift dispatch matching.';
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!existingCase || existingCase.status === 'rejected') {
      const cleanDoc = rawDocNumber.trim().toUpperCase();
      if (docType === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanDoc)) {
        errors.docNumber = 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
      } else if (docType === 'aadhaar' && cleanDoc.replace(/\s|-/g, '').length < 4) {
        errors.docNumber = 'Enter your 12-digit Aadhaar number or last 4 digits for masking.';
      }
    }
    if (upiId.trim() && !isValidIndianUpiId(upiId.trim())) {
      errors.upiId = 'Enter a valid Indian UPI handle (e.g. name@okhdfcbank or 9820198201@upi).';
    }
    if (!agreedToTerms) {
      errors.terms = 'You must accept the verification compliance terms to submit.';
    }
    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Step 1: Save Profile & Advance to Step 2
  const handleProceedToStep2 = async () => {
    if (!validateStep1()) return;
    if (!userId) {
      router.push('/auth/login?redirect=/onboarding');
      return;
    }

    setSubmitting(true);
    try {
      await updateUserProfile(userId, {
        fullName: legalName.trim(),
        city: 'Mumbai',
      });

      const bioData = JSON.stringify({
        weekendSurge: weekendSurgeEnabled,
        languages: selectedLanguages,
        updatedAt: new Date().toISOString(),
      });

      await updateWorkerProfile(userId, {
        skills: selectedRoles,
        preferredLocality: selectedLocality,
        serviceAreas: [selectedLocality],
        bio: bioData,
      });

      setStep(2);
    } catch (err: any) {
      OpsklAlert.alert('Profile Save Error', err?.message || 'Could not save work preferences.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Step 2: Final Verification & Compliance Submission
  const handleSubmitVerification = async () => {
    if (!validateStep2()) return;
    if (!userId) return;

    setSubmitting(true);
    try {
      // 1. Update UPI ID on worker profile
      if (upiId.trim()) {
        await updateWorkerProfile(userId, {
          upiId: upiId.trim(),
          profileCompletionStatus: 'completed',
        });
      }

      // 2. Upload and register KYC verification case if new or re-submitting
      if (!existingCase || existingCase.status === 'rejected') {
        const cleanDoc = rawDocNumber.trim().toUpperCase();
        const masked =
          docType === 'aadhaar'
            ? `XXXX-XXXX-${cleanDoc.slice(-4)}`
            : `${cleanDoc.slice(0, 5)}****${cleanDoc.slice(-1)}`;

        let storagePath = 'direct_compliance_upload';
        if (frontDoc) {
          const uploadRes = await uploadVerificationDocument(
            userId,
            docType,
            { uri: frontDoc.uri },
            frontDoc.mimeType
          );
          if (!uploadRes.success || !uploadRes.storagePath) {
            throw new Error(uploadRes.error || 'Failed to securely store document image. Please retry.');
          }
          storagePath = uploadRes.storagePath;
        }

        const verifyRes = await submitVerificationCaseSafe(docType, masked, storagePath);
        if (!verifyRes.success) {
          throw new Error(verifyRes.error || 'KYC case registration failed.');
        }

        // Refresh case
        const updatedCase = await fetchLatestVerificationCase(userId);
        if (updatedCase) setExistingCase(updatedCase);
      }

      await refreshProfile();

      const target = redirect || '/(tabs)';
      OpsklAlert.alert(
        'Compliance Verification Submitted',
        'Your profile preferences and identity credentials are securely logged. Our Mumbai operations desk verifies submissions within 2–4 hours. You can browse discover shifts immediately.',
        [
          {
            text: 'Go to Discover Shifts',
            onPress: () => router.replace(target as any),
          },
        ]
      );
    } catch (err: any) {
      OpsklAlert.alert('Verification Submission Error', err?.message || 'Failed to submit verification case.');
    } finally {
      setSubmitting(false);
    }
  };

  // Masked string helper
  const getDisplayMaskedDoc = () => {
    if (existingCase?.documentMaskedId) {
      return existingCase.documentMaskedId;
    }
    const clean = rawDocNumber.trim().toUpperCase();
    if (docType === 'aadhaar') {
      const last4 = clean.length >= 4 ? clean.slice(-4) : '8291';
      return `•••• •••• ${last4}`;
    }
    if (docType === 'pan') {
      const prefix = clean.length >= 5 ? clean.slice(0, 5) : 'ABCDE';
      const suffix = clean.length === 10 ? clean.slice(-1) : 'F';
      return `${prefix}••••${suffix}`;
    }
    return `•••• •••• ${clean.slice(-4) || '3049'}`;
  };

  if (loadingInitial) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingView message="Loading verified worker credentials…" />
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Worker Onboarding" onBack={() => router.replace('/welcome' as any)} />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Authentication Required"
            description="Please sign in or register with your mobile number before setting up your workforce profile."
            actionLabel="Sign In with Mobile"
            onAction={() => router.replace('/auth/login?method=phone' as any)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ backgroundColor: colors.background }}>
      <ScreenHeader
        title={step === 1 ? 'Work Preference Setup' : 'Identity Verification (KYC)'}
        onBack={() => {
          if (step === 2) {
            setStep(1);
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/welcome' as any);
          }
        }}
      />

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        {/* ========================================================================= */}
        {/* PROGRESS HEADER: Step 1 of 2 vs Step 2 of 2                             */}
        {/* ========================================================================= */}
        <View style={[styles.progressHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.stepCircle, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepCircleText}>{step}</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {step === 1 ? 'STEP 1 OF 2 • PROFILE SETUP' : 'STEP 2 OF 2 • COMPLIANCE'}
              </Text>
            </View>

            <View style={[styles.securityBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <Lock size={12} color={colors.accent} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>
                {step === 1 ? '50% COMPLETE' : 'MASKED KYC'}
              </Text>
            </View>
          </View>

          {/* Progress Bar Track */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceMuted }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.accent, width: step === 1 ? '50%' : '100%' },
              ]}
            />
          </View>
        </View>

        {/* ========================================================================= */}
        {/* STEP 1: PROFILE & SKILLS SETUP (Stitch worker_profile_skills_setup)      */}
        {/* ========================================================================= */}
        {step === 1 ? (
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {/* Title & Narrative */}
            <View>
              <Text style={[typography.h1, { color: colors.textPrimary, letterSpacing: -0.5 }]}>
                Tell us about your work preference
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                This matches you with verified event shifts across premier Mumbai venues.
              </Text>
            </View>

            {/* Legal Full Name */}
            <FormField
              label="Full Legal Name"
              helperText="Must match government ID precisely for shift accreditation and payouts"
              error={step1Errors.legalName}
            >
              <Input
                value={legalName}
                onChangeText={(t) => {
                  setLegalName(t);
                  if (step1Errors.legalName) setStep1Errors((prev) => ({ ...prev, legalName: '' }));
                }}
                placeholder="e.g. Aarav Ramesh Kulkarni"
              />
            </FormField>

            {/* Primary Locality Picker */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Primary Locality in Mumbai
                </Text>
                <View style={[styles.istTag, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accent }}>IST DISPATCH BASE</Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {LOCALITY_OPTIONS.map((loc) => {
                  const isSelected = selectedLocality === loc.id;
                  return (
                    <Pressable
                      key={loc.id}
                      onPress={() => setSelectedLocality(loc.id)}
                      style={[
                        styles.localityCard,
                        {
                          backgroundColor: isSelected ? colors.surfaceMuted : colors.surface,
                          borderColor: isSelected ? colors.accent : colors.border,
                          borderWidth: isSelected ? borders.medium : borders.hairline,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <MapPin size={16} color={isSelected ? colors.accent : colors.textSecondary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                          {loc.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                          {loc.sublabel}
                        </Text>
                      </View>
                      {isSelected ? <Check size={16} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Event Roles & Skills Selection */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Event Roles & Skills
                </Text>
                <Text style={{ fontSize: 11, color: step1Errors.roles ? colors.danger : colors.textSecondary }}>
                  Select at least 2 roles
                </Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {AVAILABLE_ROLES.map((role) => {
                  const isSelected = selectedRoles.includes(role);
                  return (
                    <Pressable
                      key={role}
                      onPress={() => {
                        setSelectedRoles((prev) =>
                          prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                        );
                        if (step1Errors.roles) setStep1Errors((prev) => ({ ...prev, roles: '' }));
                      }}
                      style={[
                        styles.roleChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: borders.hairline,
                        },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      {isSelected ? (
                        <Check size={14} color={colors.textInverse} />
                      ) : (
                        <Plus size={14} color={colors.textSecondary} />
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSelected ? colors.textInverse : colors.textPrimary,
                        }}
                      >
                        {role}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {step1Errors.roles ? (
                <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{step1Errors.roles}</Text>
              ) : null}
            </View>

            {/* Weekend Surge Shifts Toggle */}
            <View style={[styles.surgeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Calendar size={16} color={colors.accent} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Weekend Surge Shifts
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>
                  Immediate availability for weekend assignments (Fri–Sun). Increases shift allocation volume by ~40%.
                </Text>
              </View>
              <Switch
                value={weekendSurgeEnabled}
                onValueChange={setWeekendSurgeEnabled}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            {/* Language Fluency */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>
                Language Fluency
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {AVAILABLE_LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguages.includes(lang);
                  return (
                    <Pressable
                      key={lang}
                      onPress={() => {
                        setSelectedLanguages((prev) =>
                          prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                        );
                      }}
                      style={[
                        styles.langChip,
                        {
                          backgroundColor: isSelected ? colors.surfaceMuted : colors.surface,
                          borderColor: isSelected ? colors.accent : colors.border,
                          borderWidth: borders.hairline,
                        },
                      ]}
                    >
                      {isSelected ? <Check size={14} color={colors.accent} /> : null}
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                        {lang}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Average Daily Gig Rate Indicator Card */}
            <View style={[styles.rateCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <Sparkles size={18} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Average Daily Gig Rate: ₹1,800 – ₹2,400
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Based on your {LOCALITY_OPTIONS.find((l) => l.id === selectedLocality)?.label.split('&')[0]} preference profile
                </Text>
              </View>
            </View>

            {/* Advance to Step 2 Button */}
            <Button
              title="Continue to KYC Verification"
              variant="accent"
              size="lg"
              loading={submitting}
              disabled={submitting}
              icon={<ArrowRight size={18} color={colors.textInverse} />}
              iconPosition="right"
              onPress={handleProceedToStep2}
            />
          </View>
        ) : (
          /* ========================================================================= */
          /* STEP 2: MASKED KYC & COMPLIANCE STATUS (Stitch worker_masked_kyc_...)    */
          /* ========================================================================= */
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {/* Title & Narrative */}
            <View>
              <Text style={[typography.h1, { color: colors.textPrimary, letterSpacing: -0.5 }]}>
                Identity Verification (KYC)
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                Verify your legal credentials to unlock event shift payouts across Mumbai venues.
              </Text>
            </View>

            {/* Contextual Notice Banner */}
            <View style={[styles.confidentialCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <Shield size={20} color={colors.accent} style={{ marginTop: 2, flexShrink: 0 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Secure & Confidential
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                  Identity verification ensures safe shifts and timely bank settlements. Never shared publicly.
                </Text>
              </View>
            </View>

            {/* Live Operational Status Banner */}
            {existingCase?.status === 'approved' ? (
              <View style={[styles.statusBanner, { backgroundColor: colors.successLight, borderColor: colors.success, borderWidth: borders.hairline }]}>
                <CheckCircle2 size={18} color={colors.success} style={{ flexShrink: 0, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.success, textTransform: 'uppercase' }}>
                    KYC Verified & Active
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textPrimary, marginTop: 2 }}>
                    Your credentials are verified. All single-day event shifts across Mumbai are unlocked for application.
                  </Text>
                </View>
              </View>
            ) : existingCase?.status === 'rejected' ? (
              <View style={[styles.statusBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger, borderWidth: borders.hairline }]}>
                <AlertCircle size={18} color={colors.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.danger, textTransform: 'uppercase' }}>
                    Re-Submission Required
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textPrimary, marginTop: 2, lineHeight: 16 }}>
                    Reason: {existingCase.rejectionReason || 'Document photographic proof was unclear or unverified.'} Please re-upload legible front and back images below.
                  </Text>
                </View>
              </View>
            ) : existingCase?.status === 'pending' ? (
              <View style={[styles.statusBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning, borderWidth: borders.hairline }]}>
                <Clock size={18} color={colors.warning} style={{ flexShrink: 0, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.warning, textTransform: 'uppercase' }}>
                      KYC Verification Pending Review
                    </Text>
                    <View style={[styles.turnaroundTag, { backgroundColor: colors.warningLight }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.warning }}>2–4h turnaround</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textPrimary, marginTop: 4, lineHeight: 16 }}>
                    Our Mumbai operations desk reviews submissions within 2–4 hours. You can browse discover shifts immediately; applications unlock once approved.
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 6, fontWeight: '600' }}>
                    Reference #{existingCase.id.slice(0, 12)} • Submitted in IST
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Government ID Type Selector */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>
                Select Government ID Type
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'aadhaar' as WorkerDocType, label: 'Aadhaar Card', sub: 'Active' },
                  { id: 'pan' as WorkerDocType, label: 'PAN Card', sub: 'Alternative' },
                ].map((idOpt) => {
                  const isSelected = docType === idOpt.id;
                  return (
                    <Pressable
                      key={idOpt.id}
                      onPress={() => setDocType(idOpt.id)}
                      style={[
                        styles.idTypeCard,
                        {
                          backgroundColor: isSelected ? colors.surface : colors.surfaceMuted,
                          borderColor: isSelected ? colors.accent : colors.border,
                          borderWidth: isSelected ? borders.medium : borders.hairline,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <CreditCard size={18} color={isSelected ? colors.accent : colors.textMuted} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                        {idOpt.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: isSelected ? colors.accent : colors.textSecondary, fontWeight: '600' }}>
                        {idOpt.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Masked ID Display Card */}
            <View style={[styles.maskedCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {docType === 'aadhaar' ? 'Aadhaar Card Details' : 'PAN Card Details'}
                </Text>
                <Badge
                  label={existingCase?.status === 'approved' ? 'VERIFIED' : 'AUTO-MASKED'}
                  variant={existingCase?.status === 'approved' ? 'success' : 'neutral'}
                  size="sm"
                />
              </View>

              <View style={[styles.maskedBox, { backgroundColor: colors.surfaceMuted }]}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Compliant Masked Identifier
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1, marginTop: 2 }}>
                    {getDisplayMaskedDoc()}
                  </Text>
                </View>
                <Lock size={16} color={colors.accent} />
              </View>

              {!existingCase || existingCase.status === 'rejected' ? (
                <FormField
                  label={`Enter ${docType.toUpperCase()} Number (For Verification)`}
                  helperText="Never stored in plaintext. Masked before persistence."
                  error={step2Errors.docNumber}
                >
                  <Input
                    value={rawDocNumber}
                    onChangeText={(t) => {
                      setRawDocNumber(t);
                      if (step2Errors.docNumber) setStep2Errors((prev) => ({ ...prev, docNumber: '' }));
                    }}
                    placeholder={docType === 'aadhaar' ? '12-digit Aadhaar number' : '10-character PAN'}
                    maxLength={docType === 'aadhaar' ? 14 : 10}
                    autoCapitalize="characters"
                  />
                </FormField>
              ) : null}

              {/* Document Preview Slots (Front & Back) */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {/* Front Side */}
                <Pressable
                  onPress={() => setPermissionTarget('front')}
                  style={[styles.uploadSlot, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}
                  accessibilityRole="button"
                  accessibilityLabel="Attach Front Side Document"
                >
                  <View style={styles.watermarkLock}>
                    <Lock size={20} color="#FFFFFF" />
                    <Text style={styles.watermarkText}>Encrypted</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                    Front Side
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    {frontDoc ? `${frontDoc.name.slice(0, 16)}...` : 'Attach PDF/Photo'}
                  </Text>
                </Pressable>

                {/* Back Side */}
                <Pressable
                  onPress={() => setPermissionTarget('back')}
                  style={[styles.uploadSlot, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: borders.hairline }]}
                  accessibilityRole="button"
                  accessibilityLabel="Attach Back Side Document"
                >
                  <View style={styles.watermarkLock}>
                    <Lock size={20} color="#FFFFFF" />
                    <Text style={styles.watermarkText}>Encrypted</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                    Back Side
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    {backDoc ? `${backDoc.name.slice(0, 16)}...` : 'Attach PDF/Photo'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Shift Payout Settlement: UPI ID */}
            <View style={[styles.settlementCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Shift Payout Settlement
                </Text>
                <View style={[styles.instantTag, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                    UPI ON FILE
                  </Text>
                </View>
              </View>

              <FormField
                label="UPI ID or VPA Address"
                helperText="Direct daily gig settlements in ₹ disbursed upon shift supervisor check-out"
                error={step2Errors.upiId}
              >
                <Input
                  value={upiId}
                  onChangeText={(t) => {
                    setUpiId(t);
                    if (step2Errors.upiId) setStep2Errors((prev) => ({ ...prev, upiId: '' }));
                  }}
                  placeholder="e.g. aaravkulkarni@okhdfcbank"
                  autoCapitalize="none"
                />
              </FormField>
            </View>

            {/* Action CTAs */}
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                title={existingCase?.status === 'approved' ? 'Save & Go to Discover Shifts' : 'Submit for Verification'}
                variant="accent"
                size="lg"
                loading={submitting}
                disabled={submitting}
                icon={<ArrowRight size={18} color={colors.textInverse} />}
                iconPosition="right"
                onPress={handleSubmitVerification}
              />

              <Button
                title="Edit Work Preferences"
                variant="secondary"
                size="md"
                icon={<ArrowLeft size={16} color={colors.textPrimary} />}
                onPress={() => setStep(1)}
              />

              <Pressable
                onPress={() => {
                  OpsklAlert.alert(
                    'Opskl Support',
                    'For KYC or onboarding help, email workforce@opskil.com. There is no staffed 24/7 phone desk in this build.'
                  );
                }}
                style={styles.supportButton}
                accessibilityRole="button"
                accessibilityLabel="Contact Ops Desk"
              >
                <HelpCircle size={15} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
                  Need help? Contact Ops Desk
                </Text>
              </Pressable>
            </View>

            {/* Compliance Micro-Footer */}
            <View style={styles.complianceFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color={colors.textMuted} />
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                  Documents stored for manual KYC review
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 14 }}>
                Submit masked identity evidence for admin review. This build does not claim a live UIDAI AUA connection or automated bank settlement.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAwareContainer>

      {/* Contextual Permission Modal */}
      <Modal
        visible={!!permissionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setPermissionTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: borders.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Shield size={20} color={colors.accent} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                Attach Document ({permissionTarget === 'front' ? 'Front Side' : 'Back Side'})
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 16 }}>
              Opskl requires clear photographic proof of your {docType.toUpperCase()} document to verify identity and age under Indian labor compliance. Camera and gallery access are strictly used for this purpose.
            </Text>

            <View style={{ gap: 8 }}>
              <Button
                title="Take Photo with Camera"
                variant="primary"
                size="md"
                onPress={() => triggerDocumentPicker('camera')}
              />
              <Button
                title="Choose from Gallery"
                variant="secondary"
                size="md"
                onPress={() => triggerDocumentPicker('gallery')}
              />
              <Button
                title="Upload PDF Document"
                variant="secondary"
                size="md"
                onPress={() => triggerDocumentPicker('pdf')}
              />
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setPermissionTarget(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressHeaderCard: {
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  istTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  localityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  surgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  confidentialCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  turnaroundTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  idTypeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  maskedCard: {
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  maskedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  uploadSlot: {
    flex: 1,
    height: 90,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  watermarkLock: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(15, 82, 186, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  settlementCard: {
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  instantTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  complianceFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    padding: 18,
  },
});
