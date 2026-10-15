import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useOpsklTheme,
  ScreenHeader,
  Input,
  Button,
  Card,
  Badge,
  EmptyState,
  KeyboardAwareContainer,
  useAuth,
} from '@opskil/design-system';
import {
  updateWorkerProfile,
  updateUserProfile,
  submitVerificationCaseSafe,
  isValidIndianUpiId,
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
];

export default function WorkerOnboardingScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { session, refreshProfile } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [fullName, setFullName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);
  const [upiId, setUpiId] = useState('');
  const [documentType, setDocumentType] = useState<'aadhaar' | 'pan'>('aadhaar');
  const [documentNumber, setDocumentNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleComplete = async () => {
    const newErrors: Record<string, string> = {};
    if (fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your full legal name';
    }
    if (selectedSkills.length === 0) {
      newErrors.skills = 'Please select at least one core skill';
    }
    if (upiId.trim() && !isValidIndianUpiId(upiId.trim())) {
      newErrors.upiId = 'Please enter a valid Indian UPI handle (e.g. name@okhdfcbank)';
    }
    if (documentNumber.trim()) {
      const cleanDoc = documentNumber.trim().toUpperCase();
      if (documentType === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanDoc)) {
        newErrors.documentNumber = 'Enter a valid 10-character PAN number (e.g. ABCDE1234F)';
      } else if (documentType === 'aadhaar' && cleanDoc.replace(/\s|-/g, '').length < 4) {
        newErrors.documentNumber = 'Enter your 12-digit Aadhaar number or last 4 digits';
      }
    }
    if (!agreedToTerms) {
      newErrors.terms = 'Please accept the Worker Terms of Service to continue';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const userId = session?.user?.id;
    if (!userId) {
      setErrors({ upiId: 'Authentication required. Please sign in with your email address to complete profile registration.' });
      setLoading(false);
      return;
    }

    try {
      await updateUserProfile(userId, {
        fullName: fullName.trim(),
      });

      await updateWorkerProfile(userId, {
        skills: selectedSkills,
        serviceAreas: selectedLocalities,
        upiId: upiId.trim() || undefined,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
      });

      // Submit KYC document for review if provided
      if (documentNumber.trim()) {
        const cleanDoc = documentNumber.trim().toUpperCase();
        const masked = documentType === 'aadhaar'
          ? `XXXX-XXXX-${cleanDoc.slice(-4)}`
          : `${cleanDoc.slice(0, 5)}****${cleanDoc.slice(-1)}`;

        await submitVerificationCaseSafe(
          documentType,
          masked,
          `${userId}/kyc_${documentType}_${Date.now()}.pdf`
        ).catch(() => {});
      }

      await refreshProfile();

      const target = redirect || '/(tabs)';
      Alert.alert(
        'Profile Completed',
        'Your worker profile is ready. You can now browse verified event shifts across Mumbai.',
        [
          {
            text: target === '/(tabs)' ? 'Browse Shifts' : 'Continue',
            onPress: () => router.replace(target as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Profile Setup Error', err.message || 'Unable to update profile. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Worker Profile Setup" onBack={() => router.back()} />

      {!session?.user?.id ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <EmptyState
            title="Authentication Required"
            description="Please sign in or verify your email OTP before completing your worker registration profile."
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
        <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        {/* Progress & Value Prop Banner */}
        <View
          style={{
            backgroundColor: colors.surface,
            padding: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: colors.primary,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Badge label="OPSKL VERIFIED TALENT" variant="primary" size="sm" />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Step 1 of 1</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 4 }}>
            Get direct invitations and same-day UPI payouts for corporate shifts, conventions and exhibitions across Mumbai.
          </Text>
        </View>

        {/* Legal Identity Card */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Identity Information
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
            helperText="Must match government ID (Aadhaar/PAN) for shift check-ins."
          />

          <Input
            label="Base Metropolitan Hub"
            value="Mumbai Metropolitan Region (MMR)"
            editable={false}
            helperText="Initial market covers Bandra, BKC, Goregaon, Andheri, Worli & Navi Mumbai."
          />
        </Card>

        {/* Locality Preferences */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Preferred Shift Localities
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.md }}>
            Select areas where you are ready to commute on shift days.
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
                  accessibilityLabel={`Preferred locality: ${loc}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radii.full,
                    backgroundColor: isSelected ? colors.primaryLight : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isSelected ? '700' : '500',
                      color: isSelected ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {loc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Skills Selection Card */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Event Skills & Roles
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.md }}>
            Organizers prioritize workers with relevant venue experience.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AVAILABLE_SKILLS.map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <Pressable
                  key={skill}
                  onPress={() => toggleSkill(skill)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`Skill: ${skill}`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radii.full,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
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
          {errors.skills && (
            <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>
              {errors.skills}
            </Text>
          )}
        </Card>

        {/* Same-day Payout Settlement Card */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Same-Day Payout Account
          </Text>

          <Input
            label="UPI ID / VPA for Direct Settlement"
            value={upiId}
            onChangeText={(t) => {
              setUpiId(t);
              if (errors.upiId) setErrors((prev) => ({ ...prev, upiId: '' }));
            }}
            placeholder="e.g. aryan@okhdfcbank"
            error={errors.upiId}
            helperText="Agreed shift wage is paid out directly to this UPI ID upon attendance sign-off."
          />
        </Card>

        {/* Identity & Verification Card (KYC) */}
        <Card variant="outlined">
          <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Government Identity Verification (KYC)
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.md }}>
            Verified crew receive priority roster placement and faster approval from organizers.
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.sm }}>
            {(['aadhaar', 'pan'] as const).map((type) => {
              const isSelected = documentType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setDocumentType(type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.surfaceMuted : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase' }}>
                    {type === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label={documentType === 'aadhaar' ? 'Aadhaar Number (12 digits)' : 'PAN Card Number (10 characters)'}
            value={documentNumber}
            onChangeText={(t) => {
              setDocumentNumber(t);
              if (errors.documentNumber) setErrors((prev) => ({ ...prev, documentNumber: '' }));
            }}
            placeholder={documentType === 'aadhaar' ? 'e.g. 1234 5678 9012' : 'e.g. ABCDE1234F'}
            autoCapitalize="characters"
            error={errors.documentNumber}
            helperText="Stored securely and masked for verification review."
          />
        </Card>

        {/* Terms of Service & Privacy Consent */}
        <Pressable
          onPress={() => {
            setAgreedToTerms(!agreedToTerms);
            if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToTerms }}
          style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: spacing.xs }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: agreedToTerms ? colors.primary : colors.border,
              backgroundColor: agreedToTerms ? colors.primary : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.sm,
              marginTop: 2,
            }}
          >
            {agreedToTerms ? <Text style={{ color: colors.textInverse, fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
          </View>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            I agree to the Opskl Independent Worker Terms of Service, Platform Safety Guidelines, and Privacy Policy.
          </Text>
        </Pressable>
        {errors.terms ? (
          <Text style={{ color: colors.danger, fontSize: 12, marginTop: -4 }}>{errors.terms}</Text>
        ) : null}

        {/* Action Button */}
        <View style={{ marginTop: spacing.md, paddingBottom: spacing.xxl }}>
          <Button
            title="Complete Setup & View Shifts"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleComplete}
          />
        </View>
      </KeyboardAwareContainer>
      )}
    </SafeAreaView>
  );
}
