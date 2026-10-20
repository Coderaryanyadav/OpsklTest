import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Input,
  Button,
  Badge,
  WageText,
  KeyboardAwareContainer,
  useAuth,
  OpsklAlert,
  Screen,
  Stepper,
  FormField,
  WageInput,
  NumericInput,
  DateInput,
  TimeInput,
  Select,
  FilterPills,
  InlineBanner,
  FinancialSummary,
  Toggle,
  Divider,
} from '@opskil/design-system';
import {
  ShiftCategory,
  formatINR,
  getTodayDateIST,
  createJobSafe,
  calculateJobFinancials,
  universalStorage,
  resolveMumbaiVenueCoordinates,
  supabase,
} from '@opskil/shared';
import { ShiftCreateSchema } from '@opskil/validation';
import { Calendar, MapPin, User, ShieldCheck } from 'lucide-react-native';

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
  { id: 2, label: 'Venue' },
  { id: 3, label: 'Duties' },
  { id: 4, label: 'Wages' },
  { id: 5, label: 'Publish' },
];

const STEP_META = [
  { title: 'Role & Category', subtitle: 'Define shift title, category and headcount' },
  { title: 'Schedule & Venue', subtitle: 'Date, timings, venue address and reporting' },
  { title: 'Duties & Eligibility', subtitle: 'Responsibilities, skills and dress code' },
  { title: 'Wages & Terms', subtitle: 'Hourly rates, breaks, meals and policies' },
  { title: 'Review & Publish', subtitle: 'Verify details and confirm financial budget' },
];

export default function OrganizerCreateShiftScreen() {
  const router = useRouter();
  const { session, user } = useAuth();
  const { colors, spacing, typography, radii } = useOpsklTheme();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ShiftCategory>('conference');
  const [slotsTotal, setSlotsTotal] = useState('');

  const todayStr = getTodayDateIST();
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [zone, setZone] = useState('Bandra Kurla Complex (BKC)');
  const [reportingInstructions, setReportingInstructions] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorPhone, setSupervisorPhone] = useState('');

  const [duties, setDuties] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('');
  const [dressCode, setDressCode] = useState('');

  const [hourlyRate, setHourlyRate] = useState('');
  const [breaksMinutes, setBreaksMinutes] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [mealProvided, setMealProvided] = useState(false);
  const [transportProvided, setTransportProvided] = useState(false);
  const [overtimePolicy, setOvertimePolicy] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');

  const parsedRate = parseFloat(hourlyRate) || 0;
  const parsedHours = parseFloat(durationHours) || 0;
  const parsedSlots = parseInt(slotsTotal, 10) || 0;
  const perWorkerPay = parsedRate * parsedHours;
  const financials = calculateJobFinancials(parsedSlots, perWorkerPay);
  const totalCrewBudget = financials.totalWorkerWages;
  const platformFee = financials.platformFeeAmount;
  const gstFee = financials.gstAmount;
  const totalDeposit = financials.totalPayableByOrganizer;

  const buildDraftPayload = useCallback(
    () => ({
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
      reportingInstructions,
      supervisorName,
      supervisorPhone,
      duties,
      requiredSkills,
      eligibilityCriteria,
      dressCode,
      hourlyRate,
      breaksMinutes,
      applicationDeadline,
      paymentDeadline,
      mealProvided,
      transportProvided,
      overtimePolicy,
      cancellationPolicy,
      step,
    }),
    [
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
      reportingInstructions,
      supervisorName,
      supervisorPhone,
      duties,
      requiredSkills,
      eligibilityCriteria,
      dressCode,
      hourlyRate,
      breaksMinutes,
      applicationDeadline,
      paymentDeadline,
      mealProvided,
      transportProvided,
      overtimePolicy,
      cancellationPolicy,
      step,
    ]
  );

  const persistDraft = useCallback(async () => {
    try {
      await universalStorage.setItem(DRAFT_KEY, JSON.stringify(buildDraftPayload()));
    } catch {
      // Non-critical local draft failure
    }
  }, [buildDraftPayload]);

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
          if (draft.reportingInstructions) setReportingInstructions(draft.reportingInstructions);
          if (draft.supervisorName) setSupervisorName(draft.supervisorName);
          if (draft.supervisorPhone) setSupervisorPhone(draft.supervisorPhone);
          if (draft.duties) setDuties(draft.duties);
          if (draft.requiredSkills) setRequiredSkills(draft.requiredSkills);
          if (draft.eligibilityCriteria) setEligibilityCriteria(draft.eligibilityCriteria);
          if (draft.dressCode) setDressCode(draft.dressCode);
          if (draft.hourlyRate) setHourlyRate(String(draft.hourlyRate));
          if (draft.breaksMinutes) setBreaksMinutes(String(draft.breaksMinutes));
          if (draft.applicationDeadline) setApplicationDeadline(draft.applicationDeadline);
          if (draft.paymentDeadline) setPaymentDeadline(draft.paymentDeadline);
          if (draft.mealProvided !== undefined) setMealProvided(Boolean(draft.mealProvided));
          if (draft.transportProvided !== undefined) setTransportProvided(Boolean(draft.transportProvided));
          if (draft.overtimePolicy) setOvertimePolicy(draft.overtimePolicy);
          if (draft.cancellationPolicy) setCancellationPolicy(draft.cancellationPolicy);
          if (draft.step && draft.step >= 1 && draft.step <= 5) setStep(draft.step);
          setDraftRestored(true);
        }
      } catch {
        // Non-critical restore failure
      }
    }
    restoreDraft();
  }, []);

  const validateStep = (currentStep: number): boolean => {
    setSubmitError(null);
    if (currentStep === 1) {
      if (title.trim().length < 5 || title.trim().length > 80) {
        const msg = 'Shift title must be between 5 and 80 characters long.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      if (parsedSlots < 1 || parsedSlots > 50) {
        const msg = 'Headcount must be between 1 and 50 workers.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
    } else if (currentStep === 2) {
      if (date < todayStr) {
        const msg = 'Shift date cannot be in the past. Please select today or a future date in IST.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      if (!venueName.trim() || !venueAddress.trim()) {
        const msg = 'Please specify both venue name and full address.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      if (parsedHours < 1 || parsedHours > 14) {
        const msg = 'Shift duration must be between 1 and 14 hours.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      if (!supervisorName.trim() || !supervisorPhone.trim()) {
        const msg = 'On-site supervisor contact information is required.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
    } else if (currentStep === 3) {
      if (duties.trim().length < 5) {
        const msg = 'Please list shift duties with at least 5 characters.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
    } else if (currentStep === 4) {
      if (parsedRate < 100) {
        const msg = 'Minimum wage is ₹100 per hour.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      const bMins = parseInt(breaksMinutes, 10);
      if (!isNaN(bMins) && (bMins < 0 || bMins > 120)) {
        const msg = 'Break duration must be between 0 and 120 minutes.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
      if (!isNaN(bMins) && bMins >= parsedHours * 60) {
        const msg = 'Break duration cannot exceed or equal total shift duration.';
        setSubmitError(msg);
        OpsklAlert.alert('Validation Error', msg);
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (validateStep(step)) {
      const next = Math.min(step + 1, 5);
      setStep(next);
      await persistDraft();
    }
  };

  const handleBack = async () => {
    const prev = Math.max(step - 1, 1);
    setStep(prev);
    await persistDraft();
  };

  const handleSubmit = async (status: 'open' | 'draft') => {
    setSubmitError(null);
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setSubmitting(true);

    const dutiesArray = duties
      .split(/[,\n]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    const skillsArray = requiredSkills
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const resolvedVenue = await resolveMumbaiVenueCoordinates(venueName, venueAddress, zone);
    const coords = resolvedVenue.coordinates;
    const crossesMidnight = endTime && startTime ? endTime <= startTime : false;

    const payload = {
      title,
      category: (category?.toLowerCase() || 'conference') as ShiftCategory,
      venueName,
      venueAddress,
      landmark: landmark.trim() || undefined,
      city: 'Mumbai',
      zone,
      latitude: coords.lat,
      longitude: coords.lng,
      date,
      startTime,
      endTime,
      crossesMidnight,
      durationHours: parsedHours,
      hourlyRate: parsedRate,
      slotsTotal: parsedSlots,
      dressCode,
      duties: dutiesArray.length > 0 ? dutiesArray : [duties.trim()],
      requiredSkills: skillsArray,
      eligibilityCriteria,
      breaksMinutes: parseInt(breaksMinutes, 10) || 30,
      applicationDeadline: applicationDeadline.trim() ? applicationDeadline.trim() : undefined,
      paymentDeadline: paymentDeadline.trim() ? paymentDeadline.trim() : undefined,
      mealProvided,
      transportProvided,
      overtimePolicy,
      reportingInstructions,
      cancellationPolicy,
      supervisorName,
      supervisorPhone: supervisorPhone.trim(),
      status,
    };

    const validationResult = ShiftCreateSchema.safeParse(payload);
    if (!validationResult.success) {
      setSubmitting(false);
      const issue = validationResult.error.issues[0]?.message || 'Validation failed';
      setSubmitError(issue);
      OpsklAlert.alert('Validation Error', issue);
      return;
    }

    let organizerId = session?.user?.id || user?.id;
    if (!organizerId) {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        organizerId = sessData?.session?.user?.id;
      } catch {
        // Fallback
      }
    }
    if (!organizerId) {
      setSubmitError('Please sign in with a verified organizer account before publishing shifts.');
      setSubmitting(false);
      return;
    }

    const result = await createJobSafe(
      {
        ...payload,
        totalPay: perWorkerPay,
      },
      organizerId
    );

    setSubmitting(false);

    if (result.success) {
      try {
        await universalStorage.removeItem(DRAFT_KEY);
      } catch {
        // Non-critical
      }
      OpsklAlert.alert(
        status === 'draft' ? 'Draft Saved' : 'Shift Published Live',
        status === 'draft'
          ? 'Your shift has been saved to your drafts.'
          : `Your shift for ${parsedSlots} workers has been published to the Opskl marketplace.`,
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.replace('/(tabs)' as any),
          },
        ]
      );
      setTimeout(() => {
        router.replace('/(tabs)' as any);
      }, 1500);
    } else {
      if (result.errorCode === 'ORGANIZER_NOT_VERIFIED') {
        const msg =
          'Only verified business hosts can post live shifts. Visit Profile → Billing & Tax Compliance to submit your GSTIN for verification. You can still save a draft.';
        setSubmitError(msg);
        OpsklAlert.alert('Verification Required', msg, [
          { text: 'Later', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => router.push('/(tabs)/profile' as any) },
        ]);
      } else {
        const msg = result.error || 'Failed to create shift.';
        setSubmitError(msg);
        OpsklAlert.alert('Submission Error', msg);
      }
    }
  };

  return (
    <Screen edges={['top']}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {STEP_META[step - 1].title}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Step {step} of 5 • {STEP_META[step - 1].subtitle}
            </Text>
          </View>
          <Badge label={`${step}/5`} variant="primary" size="sm" />
        </View>

        <Stepper steps={WIZARD_STEPS} currentStepIndex={step - 1} style={{ marginTop: spacing.xs }} />

        {draftRestored ? (
          <InlineBanner
            variant="info"
            message="Local draft restored. Continue editing or publish when ready."
            onDismiss={() => setDraftRestored(false)}
          />
        ) : null}
      </View>

      <KeyboardAwareContainer contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {step === 1 && (
          <View style={{ gap: spacing.md }}>
            <Input
              label="Shift Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. VIP Registration Host & Usher"
              helperText="Clear, descriptive role title visible to applicants (5–80 characters)"
            />

            <FormField label="Event Category">
              <FilterPills
                items={CATEGORIES.map((c) => ({ id: c.value, label: c.label }))}
                selectedId={category}
                onSelect={(id) => setCategory(id as ShiftCategory)}
                contentContainerStyle={{ paddingHorizontal: 0 }}
              />
            </FormField>

            <NumericInput
              label="Headcount Required"
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              placeholder="e.g. 8"
              helperText="Number of verified workers needed (1–50)"
            />
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: spacing.md }}>
            <DateInput
              label="Event Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="Start Time"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TimeInput
                  label="End Time"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>

            <NumericInput
              label="Duration (Hours)"
              value={durationHours}
              onChangeText={setDurationHours}
              placeholder="9"
              helperText="Between 1 and 14 hours"
            />

            <Input
              label="Venue Name"
              value={venueName}
              onChangeText={setVenueName}
              placeholder="e.g. Jio World Convention Centre, Pavilion 2"
            />

            <Input
              label="Venue Street Address"
              value={venueAddress}
              onChangeText={setVenueAddress}
              placeholder="Full street address and pin code"
              multiline
              numberOfLines={2}
            />

            <Input
              label="Nearby Landmark"
              value={landmark}
              onChangeText={setLandmark}
              placeholder="e.g. Opposite Bharat Diamond Bourse"
            />

            <Select
              label="Mumbai Locality Zone"
              options={MUMBAI_ZONES.map((z) => ({ value: z, label: z }))}
              value={zone}
              onChange={setZone}
            />

            <Input
              label="Reporting Instructions for Workers"
              value={reportingInstructions}
              onChangeText={setReportingInstructions}
              placeholder="Where workers should report and who to meet"
              multiline
              numberOfLines={2}
            />

            <Input
              label="Supervisor Name"
              value={supervisorName}
              onChangeText={setSupervisorName}
              placeholder="e.g. Rohit Verma"
            />
            <Input
              label="Supervisor Phone"
              value={supervisorPhone}
              onChangeText={setSupervisorPhone}
              keyboardType="phone-pad"
              placeholder="e.g. 9820198201"
            />
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: spacing.md }}>
            <Input
              label="Key Responsibilities & Duties"
              value={duties}
              onChangeText={setDuties}
              placeholder="List specific tasks separated by commas or new lines"
              multiline
              numberOfLines={4}
              helperText="Workers review these duties before applying"
            />
            <Input
              label="Required Skills & Capabilities"
              value={requiredSkills}
              onChangeText={setRequiredSkills}
              placeholder="e.g. Customer Service, QR Scanning, Hindi/English"
            />
            <Input
              label="Eligibility & Age Requirements"
              value={eligibilityCriteria}
              onChangeText={setEligibilityCriteria}
              placeholder="e.g. Must be 18+ years old. Physical stamina required."
            />
            <Input
              label="Dress Code & Appearance Guidelines"
              value={dressCode}
              onChangeText={setDressCode}
              placeholder="e.g. Crisp black formal shirt, dark trousers, closed shoes"
              multiline
              numberOfLines={2}
            />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: spacing.md }}>
            <WageInput
              label="Hourly Wage per Worker"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="175"
              helperText="Minimum ₹100/hr. Shown separately from total estimated pay below."
            />

            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                padding: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Pay per worker
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Hourly wage</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  {formatINR(parsedRate)}/hr
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Total estimated pay ({parsedHours || '—'}h)
                </Text>
                <WageText style={{ fontSize: 16 }}>{formatINR(perWorkerPay)}</WageText>
              </View>
            </View>

            <FinancialSummary
              title="Crew budget estimate"
              items={[
                {
                  label: `Worker wages (${parsedSlots} × ${formatINR(perWorkerPay)})`,
                  amountLabel: formatINR(totalCrewBudget),
                },
                {
                  label: 'Platform fee (10%)',
                  amountLabel: formatINR(platformFee),
                  emphasis: 'muted',
                },
                {
                  label: 'GST on fee (18%)',
                  amountLabel: formatINR(gstFee),
                  emphasis: 'muted',
                },
              ]}
              totalLabel="Total estimated escrow"
              totalAmountLabel={formatINR(totalDeposit)}
              footnote="Wages are held in escrow and disbursed after attendance sign-off."
            />

            <NumericInput
              label="Rest Breaks (Minutes)"
              value={breaksMinutes}
              onChangeText={setBreaksMinutes}
              placeholder="30"
              helperText="0–120 minutes; cannot exceed shift duration"
            />

            <Input
              label="Application Deadline (Optional)"
              value={applicationDeadline}
              onChangeText={setApplicationDeadline}
              placeholder="YYYY-MM-DDTHH:MM"
            />
            <Input
              label="Payment Deadline (Optional)"
              value={paymentDeadline}
              onChangeText={setPaymentDeadline}
              placeholder="YYYY-MM-DDTHH:MM"
            />

            <Toggle
              label="Meal provided on-site"
              description="Lunch or dinner during break"
              value={mealProvided}
              onValueChange={setMealProvided}
            />
            <Toggle
              label="Travel / cab allowance"
              description="Reimbursement or transport arranged"
              value={transportProvided}
              onValueChange={setTransportProvided}
            />

            <Input
              label="Overtime Policy"
              value={overtimePolicy}
              onChangeText={setOvertimePolicy}
              placeholder="e.g. ₹190/hr for additional show hours if requested on-site."
            />
            <Input
              label="Cancellation Policy"
              value={cancellationPolicy}
              onChangeText={setCancellationPolicy}
              placeholder="Cancellation notice terms"
              multiline
              numberOfLines={2}
            />
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
                backgroundColor: colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[typography.h3, { color: colors.textPrimary }]} numberOfLines={2}>
                    {title || 'Untitled shift'}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {category.toUpperCase()} • {parsedSlots} positions
                  </Text>
                </View>
                <Badge label="READY" variant="success" size="sm" />
              </View>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
                gap: 8,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Event & Venue</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color={colors.primary} strokeWidth={2.2} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {date} • {startTime || '—'} – {endTime || '—'} ({parsedHours}h)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <MapPin size={14} color={colors.primary} strokeWidth={2.2} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>
                    {venueName}, {zone}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{venueAddress}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <User size={14} color={colors.textSecondary} strokeWidth={2.2} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Supervisor: {supervisorName} ({supervisorPhone})
                </Text>
              </View>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
                gap: spacing.sm,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' }}>
                Wage vs estimated pay
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Hourly wage</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  {formatINR(parsedRate)}/hr
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total estimated pay / worker</Text>
                <WageText style={{ fontSize: 16 }}>{formatINR(perWorkerPay)}</WageText>
              </View>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={13} color={colors.textPrimary} strokeWidth={2.4} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1 }}>
                  Crew escrow total: {formatINR(totalDeposit)} (wages + fees + GST)
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Breaks: {breaksMinutes || '—'} mins • Meals: {mealProvided ? 'Yes' : 'No'} • Travel:{' '}
              {transportProvided ? 'Yes' : 'No'}
            </Text>
            {dressCode ? (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Dress code: {dressCode}</Text>
            ) : null}

            {submitError ? (
              <InlineBanner variant="error" title="Cannot publish" message={submitError} />
            ) : null}
          </View>
        )}
      </KeyboardAwareContainer>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        {step > 1 ? (
          <View style={{ flex: 1 }}>
            <Button title="Back" variant="outline" size="md" onPress={handleBack} />
          </View>
        ) : null}

        {step < 5 ? (
          <View style={{ flex: 2 }}>
            <Button title="Continue" variant="primary" size="md" onPress={handleNext} />
          </View>
        ) : (
          <View style={{ flex: 2, flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Save Draft"
                variant="outline"
                size="md"
                loading={submitting}
                onPress={() => handleSubmit('draft')}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                title="Publish Shift"
                variant="primary"
                size="md"
                loading={submitting}
                onPress={() => handleSubmit('open')}
              />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
  },
});
