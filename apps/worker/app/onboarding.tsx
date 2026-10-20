import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  Checkbox,
  DocumentUpload,
  InlineBanner,
  SegmentedControl,
  FilterPills,
  Divider,
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

const AVAILABLE_SKILLS = [
  'Registration Desk & Scanning',
  'VIP Ushering & Concierge',
  'Crowd Guidance & Queues',
  'Booth Executive',
  'Backstage & Runner',
  'English & Hindi Fluent',
];

const PREFERRED_LOCALITIES = [
  'Bandra Kurla Complex (BKC)',
  'Goregaon & NESCO',
  'Worli & South Mumbai',
  'Andheri & Suburbs',
  'Navi Mumbai (Vashi / CIDCO)',
  'Thane & Central Suburbs',
];

const RADIUS_OPTIONS = [
  { label: '5 km', value: '5' },
  { label: '10 km', value: '10' },
  { label: '15 km', value: '15' },
  { label: '25 km', value: '25' },
  { label: 'All Mumbai MMR', value: '50' },
];

const AVAILABLE_LANGUAGES = ['English', 'Hindi', 'Marathi', 'Gujarati'];

export default function WorkerOnboardingScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { session, refreshProfile } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState('15');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English', 'Hindi']);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [documentType, setDocumentType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [documentNumber, setDocumentNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingCase, setExistingCase] = useState<VerificationCase | null>(null);

  const userId = session?.user?.id;

  // Save/Resume: Preload existing profile and verification state
  useEffect(() => {
    async function loadExistingData() {
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

        if (uProfile) {
          if (uProfile.fullName) setFullName(uProfile.fullName);
          if (uProfile.phone) setPhone(uProfile.phone);
        }

        if (wProfile) {
          if (wProfile.skills?.length) setSelectedSkills(wProfile.skills);
          if (wProfile.serviceAreas?.length) setSelectedLocalities(wProfile.serviceAreas);
          if (wProfile.upiId) setUpiId(wProfile.upiId);

          // Parse extra profile metadata from bio if saved
          if (wProfile.bio) {
            try {
              const meta = JSON.parse(wProfile.bio);
              if (meta.dob) setDob(meta.dob);
              if (meta.isAgeConfirmed) setIsAgeConfirmed(true);
              if (meta.radius) setSelectedRadius(meta.radius);
              if (meta.languages?.length) setSelectedLanguages(meta.languages);
              if (meta.emergencyName) setEmergencyName(meta.emergencyName);
              if (meta.emergencyPhone) setEmergencyPhone(meta.emergencyPhone);
            } catch {
              // bio was plain text
            }
          }
        }

        if (vCase) {
          setExistingCase(vCase);
          if (vCase.documentType === 'aadhaar' || vCase.documentType === 'pan') {
            setDocumentType(vCase.documentType);
          }
        }
      } catch (err) {
        console.warn('Failed to preload worker profile data', err);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadExistingData();
  }, [userId]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleLocality = (loc: string) => {
    setSelectedLocalities((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleComplete = async () => {
    const newErrors: Record<string, string> = {};

    if (fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your full legal name as it appears on your ID.';
    }

    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim().replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit Indian mobile number.';
    }

    if (!isAgeConfirmed) {
      newErrors.age = 'You must confirm that you are at least 18 years of age to work shifts.';
    }

    if (selectedSkills.length === 0) {
      newErrors.skills = 'Please select at least one core skill.';
    }

    if (selectedLocalities.length === 0) {
      newErrors.localities = 'Please select at least one preferred shift locality.';
    }

    if (upiId.trim() && !isValidIndianUpiId(upiId.trim())) {
      newErrors.upiId = 'Please enter a valid Indian UPI handle (e.g. name@okhdfcbank).';
    }

    if (emergencyPhone.trim() && !/^[6-9]\d{9}$/.test(emergencyPhone.trim().replace(/\D/g, ''))) {
      newErrors.emergencyPhone = 'Enter a valid 10-digit emergency contact phone.';
    }

    if (documentNumber.trim()) {
      const cleanDoc = documentNumber.trim().toUpperCase();
      if (documentType === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanDoc)) {
        newErrors.documentNumber = 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
      } else if (documentType === 'aadhaar' && cleanDoc.replace(/\s|-/g, '').length < 4) {
        newErrors.documentNumber = 'Enter your 12-digit Aadhaar number or last 4 digits.';
      }
    }

    if (!agreedToTerms) {
      newErrors.terms = 'Please accept the Worker Terms of Service to continue.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    if (!userId) {
      setErrors({ upiId: 'Authentication required. Please sign in to save your profile.' });
      setLoading(false);
      return;
    }

    try {
      // 1. Update base user profile
      await updateUserProfile(userId, {
        fullName: fullName.trim(),
        city: 'Mumbai',
      });

      // 2. Prepare structured worker bio metadata
      const bioMetadata = JSON.stringify({
        dob: dob.trim(),
        isAgeConfirmed: true,
        radius: selectedRadius,
        languages: selectedLanguages,
        emergencyName: emergencyName.trim(),
        emergencyPhone: emergencyPhone.trim(),
        savedAt: new Date().toISOString(),
      });

      // 3. Update worker profile
      await updateWorkerProfile(userId, {
        skills: selectedSkills,
        serviceAreas: selectedLocalities,
        preferredLocality: selectedLocalities[0] || 'Mumbai',
        bio: bioMetadata,
        upiId: upiId.trim() || undefined,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
      });

      let kycSubmitted = false;

      // 4. Submit KYC document for review if provided or resubmitted
      if (documentNumber.trim()) {
        const cleanDoc = documentNumber.trim().toUpperCase();
        const masked = documentType === 'aadhaar'
          ? `XXXX-XXXX-${cleanDoc.slice(-4)}`
          : `${cleanDoc.slice(0, 5)}****${cleanDoc.slice(-1)}`;

        const docPayload = `KYC_EVIDENCE_${documentType.toUpperCase()}_${masked}_${userId}_${Date.now()}`;
        const uploadRes = await uploadVerificationDocument(
          userId,
          documentType,
          docPayload,
          'application/pdf'
        );

        if (!uploadRes.success || !uploadRes.storagePath) {
          throw new Error(uploadRes.error || 'Failed to upload verification document. Please retry.');
        }

        const verifyRes = await submitVerificationCaseSafe(
          documentType,
          masked,
          uploadRes.storagePath
        );

        if (!verifyRes.success) {
          throw new Error(verifyRes.error || 'Verification case registration failed. Please check details and retry.');
        }

        kycSubmitted = true;
      }

      await refreshProfile();

      const target = redirect || '/(tabs)';
      OpsklAlert.alert(
        kycSubmitted ? 'Profile & Verification Submitted' : 'Profile Saved',
        kycSubmitted
          ? 'Your worker profile is complete and your verification details are queued for admin review. You can browse shifts while approval is in progress.'
          : 'Your worker profile has been successfully saved. You can now browse verified event shifts across Mumbai.',
        [
          {
            text: target === '/(tabs)' ? 'Explore Shifts' : 'Continue',
            onPress: () => router.replace(target as any),
          },
        ]
      );
    } catch (err: any) {
      OpsklAlert.alert('Profile Setup Error', err.message || 'Unable to update profile. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingInitial) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingView message="Loading worker details…" />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="Worker Profile & Onboarding"
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)' as any);
          }
        }}
      />

      {!userId ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Authentication Required"
            description="Please sign in or register before completing your worker registration profile."
            actionLabel="Sign In / Register"
            onAction={() =>
              router.replace(
                (redirect
                  ? `/auth/login?redirect=${encodeURIComponent(`/onboarding?redirect=${encodeURIComponent(redirect)}`)}`
                  : `/auth/login?redirect=/onboarding`) as any
              )
            }
          />
        </View>
      ) : (
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {existingCase?.status === 'rejected' ? (
            <InlineBanner
              variant="error"
              title="Re-submission required"
              message={`Reason: ${existingCase.rejectionReason || 'Document details were unclear or unverified.'} Update your legal name and document number below, then save again.`}
            />
          ) : null}

          {existingCase?.status === 'pending' ? (
            <InlineBanner
              variant="warning"
              title="KYC verification in progress"
              message={`Your ${existingCase.documentType.toUpperCase()} (${existingCase.documentMaskedId}) is under review by Opskl Trust & Safety.`}
            />
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge label="MUMBAI EVENT CREW" variant="primary" size="sm" />
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Save & Resume Supported</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              Complete your profile once for shift invitations, GPS check-ins, and UPI wage disbursements.
            </Text>
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              1. Legal Identity & Eligibility
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Must match government-issued identity records for venue access.
            </Text>

            <Input
              label="Full Legal Name"
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
              }}
              placeholder="e.g. Aryan Yadav"
              error={errors.fullName}
              helperText="As written on your Aadhaar / PAN card."
            />

            <Input
              label="Contact Mobile Number"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              error={errors.phone}
              helperText="Used for shift emergency coordination."
            />

            <Input
              label="Date of Birth"
              value={dob}
              onChangeText={(t) => setDob(t)}
              placeholder="DD/MM/YYYY"
              helperText="For eligibility verification."
            />

            <Checkbox
              checked={isAgeConfirmed}
              onChange={(checked) => {
                setIsAgeConfirmed(checked);
                if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
              }}
              label="I confirm that I am at least 18 years old and legally eligible to work event shifts in India."
            />
            {errors.age ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>{errors.age}</Text>
            ) : null}
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              2. Work Radius & Preferred Localities
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Set your travel distance and key event hubs in Mumbai.
            </Text>

            <FormField label="Maximum Commute Radius">
              <FilterPills
                items={RADIUS_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label }))}
                selectedId={selectedRadius}
                onSelect={setSelectedRadius}
                contentContainerStyle={{ paddingHorizontal: 0 }}
              />
            </FormField>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              Preferred Shift Areas (Select all that apply)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PREFERRED_LOCALITIES.map((loc) => {
                const isSelected = selectedLocalities.includes(loc);
                return (
                  <Pressable
                    key={loc}
                    onPress={() => toggleLocality(loc)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {loc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.localities ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>{errors.localities}</Text>
            ) : null}
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              3. Event Roles, Skills & Languages
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Highlight your on-ground capabilities for event organizers.
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              Core Event Roles
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
              {AVAILABLE_SKILLS.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <Pressable
                    key={skill}
                    onPress={() => toggleSkill(skill)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {skill}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.skills ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>{errors.skills}</Text>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              Languages Spoken Fluently
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {AVAILABLE_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguages.includes(lang);
                return (
                  <Pressable
                    key={lang}
                    onPress={() => toggleLanguage(lang)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: radii.full,
                      backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {lang}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              4. Emergency Contact
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Required for high-crowd venue safety and worker welfare.
            </Text>

            <Input
              label="Contact Person Name"
              value={emergencyName}
              onChangeText={(t) => setEmergencyName(t)}
              placeholder="e.g. Parent / Sibling / Guardian"
            />

            <Input
              label="Emergency Phone Number"
              value={emergencyPhone}
              onChangeText={(t) => {
                setEmergencyPhone(t);
                if (errors.emergencyPhone) setErrors((prev) => ({ ...prev, emergencyPhone: '' }));
              }}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              error={errors.emergencyPhone}
              helperText="Only contacted during urgent medical or safety incidents."
            />
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              5. Shift Wage Disbursement (UPI)
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Direct settlement into your Indian bank account upon organizer checkout sign-off.
            </Text>

            <Input
              label="UPI ID / VPA Handle"
              value={upiId}
              onChangeText={(t) => {
                setUpiId(t);
                if (errors.upiId) setErrors((prev) => ({ ...prev, upiId: '' }));
              }}
              placeholder="e.g. yourname@okhdfcbank"
              error={errors.upiId}
              helperText="Must support instant UPI transfers (Google Pay, PhonePe, Paytm, BHIM)."
            />
          </View>

          <Divider />

          <View>
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              6. Government ID Verification (KYC)
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>
              Submit verification details for Opskl Trust & Safety review. A camera-roll photo is not attached unless you later add document upload support.
            </Text>

            <SegmentedControl
              options={[
                { value: 'aadhaar', label: 'Aadhaar Card' },
                { value: 'pan', label: 'PAN Card' },
              ]}
              value={documentType}
              onChange={setDocumentType}
              style={{ marginBottom: spacing.md }}
            />

            <Input
              label={documentType === 'aadhaar' ? 'Aadhaar Number (12 digits)' : 'PAN Card Number (10 characters)'}
              value={documentNumber}
              onChangeText={(t) => {
                setDocumentNumber(t);
                if (errors.documentNumber) setErrors((prev) => ({ ...prev, documentNumber: '' }));
              }}
              placeholder={documentType === 'aadhaar' ? '12-digit Aadhaar' : '10-character PAN'}
              autoCapitalize="characters"
              secureTextEntry
              textContentType="none"
              autoComplete="off"
              error={errors.documentNumber}
              helperText="Entered privately on this device. Values are masked in the field and not shown on Profile. Optional — save without KYC and submit later."
            />

            <DocumentUpload
              label="Verification submission"
              fileName={
                documentNumber.trim()
                  ? `${documentType.toUpperCase()} details ready to submit`
                  : null
              }
              helperText="No gallery file is attached. Saving the profile submits the document number above for admin review."
              onPick={() => {
                OpsklAlert.alert(
                  'Submit Verification Details',
                  'Enter your Aadhaar or PAN number above, then tap Save Profile. Opskl will queue a verification case for admin review. In-app camera/gallery upload is not enabled in this build.'
                );
              }}
              onClear={documentNumber.trim() ? () => setDocumentNumber('') : undefined}
            />
          </View>

          <Checkbox
            checked={agreedToTerms}
            onChange={(checked) => {
              setAgreedToTerms(checked);
              if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
            }}
            label="I agree to the Opskl Independent Worker Terms of Service, Platform Safety Guidelines, and Privacy Policy."
          />
          {errors.terms ? (
            <Text style={{ color: colors.danger, fontSize: 12 }}>{errors.terms}</Text>
          ) : null}

          <View style={{ marginTop: spacing.md, paddingBottom: spacing.xxl }}>
            <Button
              title="Save Profile & Continue"
              variant="primary"
              size="lg"
              loading={loading}
              onPress={handleComplete}
            />
          </View>
        </KeyboardAwareContainer>
      )}
    </Screen>
  );
}
