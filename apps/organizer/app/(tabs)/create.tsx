import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Input,
  Button,
  WageText,
  KeyboardAwareContainer,
  useAuth,
  OpsklAlert,
  Screen,
  WageInput,
  NumericInput,
  DateInput,
  TimeInput,
  InlineBanner,
} from '@opskil/design-system';
import {
  ShiftCategory,
  formatINR,
  formatISTDate,
  getTodayDateIST,
  createJobSafe,
  calculateJobFinancials,
  universalStorage,
  resolveMumbaiVenueCoordinates,
} from '@opskil/shared';
import {
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Utensils,
  Wind,
  BadgeAlert,
  Car,
  ArrowLeft,
  Lock,
  Gavel,
  Calculator,
  Info,
} from 'lucide-react-native';

const DRAFT_KEY = '@opskil_organizer_shift_draft';

const CATEGORIES: { label: string; value: ShiftCategory }[] = [
  { label: 'Conference', value: 'conference' },
  { label: 'Exhibition', value: 'exhibition' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Activation', value: 'activation' },
  { label: 'Hospitality', value: 'hospitality' },
  { label: 'Support', value: 'support' },
];

const MUMBAI_ZONES = [
  'Bandra Kurla Complex (BKC)',
  'Goregaon & NESCO',
  'Worli & South Mumbai',
  'Andheri & Western Suburbs',
  'Powai & Central Mumbai',
  'Navi Mumbai (Vashi / CIDCO)',
  'Thane & Suburbs',
];

const WIZARD_STEPS = [
  { id: 1, label: 'Role' },
  { id: 2, label: 'Roster' },
  { id: 3, label: 'Escrow' },
  { id: 4, label: 'Briefing' },
];

const STEP_META = [
  { title: 'Role & Responsibilities', subtitle: 'Step 1 of 4 • Define role title, category and headcount' },
  { title: 'Schedule & Venue Roster', subtitle: 'Step 2 of 4 • Date, timings, venue location and lead' },
  { title: 'Wage & Fee Estimate', subtitle: 'Step 3 of 4 • Worker pay, welfare, amenities and fee breakdown' },
  { title: 'Briefing & Final Publish', subtitle: 'Step 4 of 4 • Verification review and live dispatch' },
];

export default function OrganizerCreateShiftScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii } = useOpsklTheme();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Step 1: Role
  const [title, setTitle] = useState('Lead Guest Relations & VIP Concierge');
  const [category, setCategory] = useState<ShiftCategory>('conference');
  const [slotsTotal, setSlotsTotal] = useState('6');
  const [duties, setDuties] = useState('VIP reception, delegate badge distribution, lounge concierge, coordination with event protocol lead');
  const [requiredSkills, setRequiredSkills] = useState('Guest Relations, Fluent English, Professional Presentation');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('Must be 18+ years old. Experience in high-profile luxury summits preferred.');

  // Step 2: Roster & Venue
  const todayStr = getTodayDateIST();
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('19:00');
  const [durationHours, setDurationHours] = useState('9');
  const [venueName, setVenueName] = useState('Jio World Convention Centre, Gate 4');
  const [venueAddress, setVenueAddress] = useState('G Block BKC, Bandra East, Mumbai 400098');
  const [landmark, setLandmark] = useState('Gate 4 Security Concourse');
  const [zone, setZone] = useState('Bandra Kurla Complex (BKC)');
  const [supervisorName, setSupervisorName] = useState('Rohit Verma');
  const [supervisorPhone, setSupervisorPhone] = useState('9820198201');

  // Step 3: Wages & Escrow (Stitch Screen 16 Focal)
  const [payBasis, setPayBasis] = useState<'shift' | 'hourly'>('shift');
  const [shiftRate, setShiftRate] = useState('2400');
  const [hourlyRate, setHourlyRate] = useState('266.67');
  const [overtimeRate] = useState('350');
  const [breaksMinutes] = useState('45');
  const [mealProvided, setMealProvided] = useState(true);
  const [acLoungeProvided, setAcLoungeProvided] = useState(true);
  const [rfidBadgeProvided, setRfidBadgeProvided] = useState(true);
  const [cabAllowanceProvided, setCabAllowanceProvided] = useState(false);
  const [dressCode, setDressCode] = useState('Formal Western Black Suit (Tailored jacket, formal trousers, crisp white collared shirt, black oxfords) OR Formal Black Plain Sari. Neat grooming mandatory.');
  const [reportingInstructions, setReportingInstructions] = useState('Report 30 minutes prior at the venue staff entrance. Check in with your supervisor for floor assignment. Pass-code check-in is used in-app (no biometric badge system wired).');
  const [cancellationPolicy] = useState('Free cancellation up to 18 hours prior to shift. Unannounced no-shows impact eligibility for premium shifts.');

  // Calculations
  const parsedHours = parseFloat(durationHours) || 9;
  const parsedSlots = parseInt(slotsTotal, 10) || 6;
  const computedShiftPay = payBasis === 'shift'
    ? (parseFloat(shiftRate) || 2400)
    : (parseFloat(hourlyRate) || 266.67) * parsedHours;
  const effectiveHourly = (computedShiftPay / (parsedHours || 1)).toFixed(2);

  const financials = calculateJobFinancials(parsedSlots, computedShiftPay);
  const totalCrewBudget = financials.totalWorkerWages;
  const platformFee = financials.platformFeeAmount;
  const gstFee = financials.gstAmount;
  const totalEscrowRequired = financials.totalPayableByOrganizer;

  // Restore Draft on mount
  useEffect(() => {
    async function restoreDraft() {
      try {
        const draftJson = await universalStorage.getItem(DRAFT_KEY);
        if (draftJson) {
          const draft = JSON.parse(draftJson);
          if (draft.title) setTitle(draft.title);
          if (draft.category) setCategory(draft.category);
          if (draft.slotsTotal) setSlotsTotal(String(draft.slotsTotal));
          if (draft.date) setDate(draft.date);
          if (draft.startTime) setStartTime(draft.startTime);
          if (draft.endTime) setEndTime(draft.endTime);
          if (draft.durationHours) setDurationHours(String(draft.durationHours));
          if (draft.venueName) setVenueName(draft.venueName);
          if (draft.venueAddress) setVenueAddress(draft.venueAddress);
          if (draft.landmark) setLandmark(draft.landmark);
          if (draft.zone) setZone(draft.zone);
          if (draft.shiftRate) setShiftRate(String(draft.shiftRate));
          if (draft.hourlyRate) setHourlyRate(String(draft.hourlyRate));
          if (draft.duties) setDuties(draft.duties);
          if (draft.dressCode) setDressCode(draft.dressCode);
          if (draft.reportingInstructions) setReportingInstructions(draft.reportingInstructions);
          setDraftRestored(true);
        }
      } catch {
        // Ignored
      }
    }
    restoreDraft();
  }, []);

  const persistDraft = useCallback(async () => {
    try {
      setSavingDraft(true);
      const payload = {
        title,
        category,
        slotsTotal,
        date,
        startTime,
        endTime,
        durationHours,
        venueName,
        venueAddress,
        landmark,
        zone,
        shiftRate,
        hourlyRate,
        duties,
        dressCode,
        reportingInstructions,
        step,
      };
      await universalStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      OpsklAlert.alert('Draft Saved', 'Shift configuration saved locally. You can resume editing anytime.');
    } catch {
      OpsklAlert.alert('Error', 'Could not save local draft.');
    } finally {
      setSavingDraft(false);
    }
  }, [
    title,
    category,
    slotsTotal,
    date,
    startTime,
    endTime,
    durationHours,
    venueName,
    venueAddress,
    landmark,
    zone,
    shiftRate,
    hourlyRate,
    duties,
    dressCode,
    reportingInstructions,
    step,
  ]);

  const validateCurrentStep = (): boolean => {
    setSubmitError(null);
    if (step === 1) {
      if (title.trim().length < 5) {
        setSubmitError('Shift title must be at least 5 characters long.');
        return false;
      }
      if (parsedSlots < 1) {
        setSubmitError('Headcount must be at least 1 worker.');
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!venueName.trim() || venueName.trim().length < 3) {
        setSubmitError('Please enter a valid Mumbai venue name.');
        return false;
      }
      if (!venueAddress.trim() || venueAddress.trim().length < 5) {
        setSubmitError('Please enter a detailed venue address.');
        return false;
      }
      if (!supervisorPhone.trim() || supervisorPhone.trim().length < 10) {
        setSubmitError('Valid 10-digit supervisor phone required for venue checkpost muster.');
        return false;
      }
      return true;
    }

    if (step === 3) {
      const effectiveRateNum = parseFloat(effectiveHourly);
      if (effectiveRateNum < 100) {
        setSubmitError('Minimum allowable wage under Indian labor compliance is ₹100/hr.');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (step < 4) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    const organizerId = session?.user?.id;
    if (!organizerId) {
      OpsklAlert.alert('Authentication Required', 'Please sign in to publish or save shifts.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const coords = await resolveMumbaiVenueCoordinates(venueName, zone);
      const effectiveHourlyNum = parseFloat(effectiveHourly);

      const splitDuties = duties
        .split(/[,\n]/)
        .map((d) => d.trim())
        .filter(Boolean);

      const splitSkills = requiredSkills
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const shiftPayload = {
        title: title.trim(),
        category,
        venueName: venueName.trim(),
        venueAddress: venueAddress.trim(),
        landmark: landmark.trim() || undefined,
        city: 'Mumbai',
        zone,
        latitude: coords?.coordinates?.lat,
        longitude: coords?.coordinates?.lng,
        date,
        startTime,
        endTime,
        durationHours: parsedHours,
        hourlyRate: effectiveHourlyNum,
        totalPay: computedShiftPay,
        slotsTotal: parsedSlots,
        slotsFilled: 0,
        duties: splitDuties.length > 0 ? splitDuties : ['Guest Relations', 'Badge Distribution'],
        requiredSkills: splitSkills.length > 0 ? splitSkills : ['Hospitality', 'English'],
        eligibilityCriteria: eligibilityCriteria.trim() || 'Must be 18+ years old.',
        breaksMinutes: parseInt(breaksMinutes, 10) || 45,
        mealProvided,
        transportProvided: cabAllowanceProvided,
        overtimePolicy: `₹${overtimeRate}/hr for authorized post-shift overrun computed in 30-min increments.`,
        reportingInstructions: reportingInstructions.trim() || 'Report 30 minutes prior at Gate 4.',
        cancellationPolicy: cancellationPolicy.trim() || 'Free cancellation up to 18 hours prior.',
        dressCode: dressCode.trim() || 'Formal Western Black Suit or Plain Black Sari.',
        supervisorName: supervisorName.trim() || 'Operations Lead',
        supervisorPhone: supervisorPhone.trim() || '9820198201',
        status: 'open' as const,
      };

      const result = await createJobSafe(shiftPayload, organizerId);
      setSubmitting(false);

      if (result.success) {
        await universalStorage.removeItem(DRAFT_KEY).catch(() => null);
        OpsklAlert.alert(
          '✓ Shift Created & Published',
          `Shift "${title}" is now active on the Opskl Mumbai crew marketplace. Estimated organizer obligation: ${formatINR(totalEscrowRequired)} (wages + fees; not a live bank escrow hold).`,
          [
            {
              text: 'View in Roster',
              onPress: () => router.replace('/(tabs)/roster'),
            },
          ]
        );
      } else {
        if (result.errorCode === 'ORGANIZER_NOT_VERIFIED') {
          OpsklAlert.alert(
            'Business Verification Required',
            'Your shift draft has been saved. To publish live shifts and recruit crew across Mumbai venues, Indian legal entity verification is required.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Verify Entity', onPress: () => router.push('/verification' as any) },
            ]
          );
        } else {
          setSubmitError(result.error || 'Failed to create shift.');
          OpsklAlert.alert('Submission Error', result.error || 'Could not create shift.');
        }
      }
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(err?.message || 'Unexpected error creating shift.');
      OpsklAlert.alert('Error', err?.message || 'Failed to publish shift.');
    }
  };

  return (
    <Screen edges={['top']}>
      {/* Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={handleBack}
            style={{
              width: 36,
              height: 36,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              Multi Step Shift Creator & Wage Spec
            </Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Step {step} of 4 • {WIZARD_STEPS[step - 1].label}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={persistDraft}
          disabled={savingDraft}
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

      {/* Step Progress Line & Labels */}
      <View
        style={{
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderMuted,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {STEP_META[step - 1].subtitle}
          </Text>
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>
            {step < 4 ? `Next: ${WIZARD_STEPS[step].label}` : 'Final Step'}
          </Text>
        </View>

        {/* 4-Segment Progress Bar */}
        <View style={{ flexDirection: 'row', gap: 6, height: 5 }}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderRadius: 2.5,
                backgroundColor: i <= step ? colors.primary : colors.surfaceMuted,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          {WIZARD_STEPS.map((s) => (
            <Text
              key={s.id}
              style={{
                fontSize: 11,
                fontWeight: s.id === step ? '800' : '500',
                color: s.id === step ? colors.primary : colors.textSecondary,
              }}
            >
              {s.id <= step ? '✓ ' : ''}{s.label}
            </Text>
          ))}
        </View>
      </View>

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 110 }}>
        {draftRestored && (
          <InlineBanner
            variant="info"
            title="Local Draft Restored"
            message="Your previously saved shift draft has been loaded. Continue editing or publish."
            onDismiss={() => setDraftRestored(false)}
          />
        )}

        {submitError && (
          <InlineBanner
            variant="error"
            title="Configuration Notice"
            message={submitError}
            onDismiss={() => setSubmitError(null)}
          />
        )}

        {/* Step 1: Role & Responsibilities */}
        {step === 1 && (
          <View style={{ gap: spacing.md }}>
            <Input
              label="Shift Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Lead Guest Relations & VIP Concierge"
              helperText="Specific role title visible to applicants"
            />

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                Event Category
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: radii.md,
                      backgroundColor: category === c.value ? colors.primary : colors.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: category === c.value ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <NumericInput
              label="Staff Headcount (Confirmed Cap)"
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              placeholder="6"
              helperText="Number of verified crew positions to recruit"
            />

            <Input
              label="Duties & Core Responsibilities"
              value={duties}
              onChangeText={setDuties}
              placeholder="VIP reception, delegate badge distribution..."
              multiline
              numberOfLines={3}
            />

            <Input
              label="Required Skills & Competencies"
              value={requiredSkills}
              onChangeText={setRequiredSkills}
              placeholder="Guest Relations, Fluent English, High Grooming"
            />

            <Input
              label="Eligibility Criteria"
              value={eligibilityCriteria}
              onChangeText={setEligibilityCriteria}
              placeholder="Must be 18+ years old. Physical stamina required."
            />
          </View>
        )}

        {/* Step 2: Roster Schedule & Venue */}
        {step === 2 && (
          <View style={{ gap: spacing.md }}>
            <DateInput
              label="Shift Date"
              value={date}
              onChangeText={setDate}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Start Call Time (IST)"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="10:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="End Time (IST)"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="19:00"
                />
              </View>
            </View>

            <NumericInput
              label="Scheduled Duration (Hours)"
              value={durationHours}
              onChangeText={setDurationHours}
              placeholder="9"
              helperText="Computed hours used for wage and fee estimates"
            />

            <Input
              label="Venue Name"
              value={venueName}
              onChangeText={setVenueName}
              placeholder="Jio World Convention Centre, Gate 4"
            />

            <Input
              label="Detailed Venue Address"
              value={venueAddress}
              onChangeText={setVenueAddress}
              placeholder="G Block BKC, Bandra East, Mumbai 400098"
              multiline
              numberOfLines={2}
            />

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                Mumbai Zone
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {MUMBAI_ZONES.slice(0, 4).map((z) => (
                  <TouchableOpacity
                    key={z}
                    onPress={() => setZone(z)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radii.md,
                      backgroundColor: zone === z ? colors.primary : colors.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: zone === z ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      {z}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="On-Site Lead Name"
                  value={supervisorName}
                  onChangeText={setSupervisorName}
                  placeholder="Rohit Verma"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Lead Phone"
                  value={supervisorPhone}
                  onChangeText={setSupervisorPhone}
                  placeholder="9820198201"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        )}

        {/* Step 3: Wage & Escrow Allocation (Stitch Screen 16 Focal) */}
        {step === 3 && (
          <View style={{ gap: spacing.md }}>
            {/* Shift Summary Card (Bento Style Context Anchor) */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: radii.full,
                      backgroundColor: colors.surfaceMuted,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
                      Live Draft
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                    {title}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>
                    {parsedSlots} Staff
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Confirmed Cap
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 10, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.textPrimary, fontWeight: '600' }} numberOfLines={1}>
                    {venueName}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color={colors.textSecondary} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {formatISTDate(date)} • {startTime} – {endTime} IST
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary, backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm }}>
                    {parsedHours} hrs
                  </Text>
                </View>
              </View>
            </View>

            {/* Wage Structure Configurator */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Worker Payout Basis
                </Text>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                    Direct Net
                  </Text>
                </View>
              </View>

              {/* Segmented Control for Pay Basis */}
              <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 3, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => setPayBasis('shift')}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii.sm,
                    backgroundColor: payBasis === 'shift' ? colors.surface : 'transparent',
                    borderWidth: payBasis === 'shift' ? 1 : 0,
                    borderColor: colors.borderMuted,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: payBasis === 'shift' ? '700' : '500', color: colors.textPrimary }}>
                    Per Shift (Fixed)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPayBasis('hourly')}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii.sm,
                    backgroundColor: payBasis === 'hourly' ? colors.surface : 'transparent',
                    borderWidth: payBasis === 'hourly' ? 1 : 0,
                    borderColor: colors.borderMuted,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: payBasis === 'hourly' ? '700' : '500', color: colors.textPrimary }}>
                    Hourly (₹/hr)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Base Pay Input Field */}
              {payBasis === 'shift' ? (
                <WageInput
                  label="Guaranteed Base Net Pay Per Worker"
                  value={shiftRate}
                  onChangeText={(val) => {
                    setShiftRate(val);
                    const parsed = parseFloat(val) || 0;
                    setHourlyRate((parsed / (parsedHours || 1)).toFixed(2));
                  }}
                  placeholder="2400"
                  helperText="Total net wage received per worker for full shift duration"
                />
              ) : (
                <WageInput
                  label="Guaranteed Base Hourly Wage"
                  value={hourlyRate}
                  onChangeText={(val) => {
                    setHourlyRate(val);
                    const parsed = parseFloat(val) || 0;
                    setShiftRate((parsed * (parsedHours || 1)).toFixed(0));
                  }}
                  placeholder="266.67"
                  helperText="Hourly wage computed across scheduled hours"
                />
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Calculator size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Effective rate: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>₹{effectiveHourly} / hour</Text>
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  {parsedHours} Hours Total
                </Text>
              </View>

              {/* Statutory Fair Wage Benchmark Badge */}
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: 10,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Exceeds Mumbai Hospitality Benchmark
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                    Skilled standard for BKC Corporate & VIP summits is ₹1,500/day. This shift rate ensures higher worker acceptance and zero call-offs.
                  </Text>
                </View>
              </View>

              {/* Overtime Policy Sub-card */}
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: 10,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Overtime (OT) Policy
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>
                    ₹{overtimeRate} / hr
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  Charged only for authorized post-shift overrun. Logged via organizer digital sign-off and computed in 30-minute increments.
                </Text>
              </View>
            </View>

            {/* On-Site Logistics & Welfare Amenities */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  On-Site Logistics & Welfare
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                  Guaranteed to Staff
                </Text>
              </View>

              {/* Amenity 1: Catered Crew Meals */}
              <Pressable
                onPress={() => setMealProvided((prev) => !prev)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: mealProvided ? colors.surfaceMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: mealProvided ? colors.borderMuted : colors.surfaceMuted,
                }}
              >
                <Utensils size={18} color={mealProvided ? colors.primary : colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Catered Crew Meals
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Hygienic hot buffet lunch & dinner provided in vendor canteen.
                  </Text>
                </View>
                <CheckCircle2 size={16} color={mealProvided ? colors.primary : colors.textMuted} />
              </Pressable>

              {/* Amenity 2: AC Lounge */}
              <Pressable
                onPress={() => setAcLoungeProvided((prev) => !prev)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: acLoungeProvided ? colors.surfaceMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: acLoungeProvided ? colors.borderMuted : colors.surfaceMuted,
                }}
              >
                <Wind size={18} color={acLoungeProvided ? colors.primary : colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Air-Conditioned Lounge & Restroom
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Dedicated hospitality green room with chilled drinking water.
                  </Text>
                </View>
                <CheckCircle2 size={16} color={acLoungeProvided ? colors.primary : colors.textMuted} />
              </Pressable>

              {/* Amenity 3: RFID Pass */}
              <Pressable
                onPress={() => setRfidBadgeProvided((prev) => !prev)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: rfidBadgeProvided ? colors.surfaceMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: rfidBadgeProvided ? colors.borderMuted : colors.surfaceMuted,
                }}
              >
                <BadgeAlert size={18} color={rfidBadgeProvided ? colors.primary : colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Physical RFID Event Pass / Badge
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Issued at Gate 4 security check post during morning muster.
                  </Text>
                </View>
                <CheckCircle2 size={16} color={rfidBadgeProvided ? colors.primary : colors.textMuted} />
              </Pressable>

              {/* Amenity 4: Late Night Cab */}
              <Pressable
                onPress={() => setCabAllowanceProvided((prev) => !prev)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: radii.md,
                  backgroundColor: cabAllowanceProvided ? colors.surfaceMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: cabAllowanceProvided ? colors.borderMuted : colors.surfaceMuted,
                }}
              >
                <Car size={18} color={cabAllowanceProvided ? colors.primary : colors.textMuted} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Late Night Cab Allowance
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Not compulsory for shifts concluding before 11:00 PM IST.
                  </Text>
                </View>
                <CheckCircle2 size={16} color={cabAllowanceProvided ? colors.primary : colors.textMuted} />
              </Pressable>
            </View>

            {/* Mandatory Attire & Reporting Guidelines */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Mandatory Attire & Reporting
              </Text>

              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 10, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Dress Code Standard
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  {dressCode}
                </Text>
              </View>

              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 10, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Reporting & Muster Time
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                  {reportingInstructions}
                </Text>
              </View>
            </View>

            {/* Transparent Financial & Escrow Breakdown */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                    Escrow Deposit Breakdown
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Auditable, non-negotiable statutory schedule
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                    Estimate
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Base Crew Wage ({parsedSlots} Workers × {formatINR(computedShiftPay)})
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    {formatINR(totalCrewBudget)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Opskl Coordination Fee (10%)
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {formatINR(platformFee)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    GST on Platform Fee (18%)
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {formatINR(gstFee)}
                  </Text>
                </View>

                {/* Total funding estimate — not a live bank escrow hold */}
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: radii.md,
                    padding: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Estimated Organizer Total
                    </Text>
                    <WageText style={{ fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                      {formatINR(totalEscrowRequired)}
                    </WageText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Lock size={14} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                      Fee estimate
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: 10,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <Gavel size={15} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Worker wage transparency: </Text>
                  The {formatINR(totalCrewBudget)} crew wage pool is not deducted for platform fees. Fees ({formatINR(platformFee)} + {formatINR(gstFee)} GST) are billed to the organizer. Live nodal bank escrow is not integrated in this build — totals are estimates only.
                </Text>
              </View>
            </View>

            {/* Quick Compliance Footer */}
            <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 }}>
              Complies with Maharashtra Shops & Establishments Regulation
            </Text>
          </View>
        )}

        {/* Step 4: Briefing & Final Review */}
        {step === 4 && (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                Final Shift Blueprint Review
              </Text>

              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 12, gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  {title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {category.toUpperCase()} • {parsedSlots} Staff Opening{parsedSlots === 1 ? '' : 's'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {venueName} • {formatISTDate(date)} ({startTime} – {endTime} IST)
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 4 }}>
                  Net Worker Payout: {formatINR(computedShiftPay)} / shift (₹{effectiveHourly}/hr)
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Escrow Summary
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Crew Wage Pool</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {formatINR(totalCrewBudget)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Platform & Statutory GST</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {formatINR(platformFee + gstFee)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderMuted, paddingTop: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>Total Required</Text>
                  <WageText style={{ fontSize: 16, fontWeight: '800' }}>
                    {formatINR(totalEscrowRequired)}
                  </WageText>
                </View>
              </View>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <Info size={16} color={colors.primary} style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 }}>
                Publishing broadcasts this shift to verified Mumbai crew matching your skills criteria. Applications and confirmations appear immediately on your Roster desk.
              </Text>
            </View>
          </View>
        )}

        {/* Wizard Bottom Navigation Buttons */}
        <View style={{ gap: 8, marginTop: spacing.sm }}>
          {step < 4 ? (
            <Button
              title={step === 3 ? 'Continue to Crew Briefing' : 'Next Step'}
              variant="primary"
              size="lg"
              onPress={handleNext}
            />
          ) : (
            <Button
              title="Publish Shift Listing"
              variant="primary"
              size="lg"
              loading={submitting}
              onPress={handleSubmit}
            />
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {step > 1 && (
              <View style={{ flex: 1 }}>
                <Button
                  title="Back"
                  variant="outline"
                  size="md"
                  onPress={handleBack}
                />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Button
                title={savingDraft ? 'Saving…' : 'Save as Draft'}
                variant="ghost"
                size="md"
                onPress={persistDraft}
              />
            </View>
          </View>
        </View>
      </KeyboardAwareContainer>
    </Screen>
  );
}
