import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Input,
  Button,
  Card,
  Badge,
  WageText,
  useAuth,
} from '@opskil/design-system';
import {
  ShiftCategory,
  formatINR,
  getTodayDateIST,
  createJobSafe,
  calculateJobFinancials,
} from '@opskil/shared';
import { ShiftCreateSchema } from '@opskil/validation';

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
  { step: 1, title: 'Role & Category', subtitle: 'Define shift title, category and headcount' },
  { step: 2, title: 'Schedule & Venue', subtitle: 'Date, timings, venue address and reporting' },
  { step: 3, title: 'Duties & Eligibility', subtitle: 'Responsibilities, skills and dress code' },
  { step: 4, title: 'Wages & Terms', subtitle: 'Hourly rates, breaks, meals and policies' },
  { step: 5, title: 'Review & Publish', subtitle: 'Verify details and confirm financial budget' },
];

export default function OrganizerCreateShiftScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, typography, isDark } = useOpsklTheme();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Role & Category
  const [title, setTitle] = useState('Registration Desk & Usher');
  const [category, setCategory] = useState<ShiftCategory>('exhibition');
  const [slotsTotal, setSlotsTotal] = useState('8');

  // Step 2: Schedule & Venue
  const todayStr = getTodayDateIST();
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [durationHours, setDurationHours] = useState('9');
  const [venueName, setVenueName] = useState('Bombay Exhibition Centre (NESCO)');
  const [venueAddress, setVenueAddress] = useState('Western Express Highway, Goregaon East, Mumbai 400063');
  const [landmark, setLandmark] = useState('Near Ram Mandir Station');
  const [zone, setZone] = useState('Goregaon & NESCO');
  const [reportingInstructions, setReportingInstructions] = useState('Report to Exhibitor Gate 2 by 8:30 AM for on-site badge issue and morning briefing.');
  const [supervisorName, setSupervisorName] = useState('Rohit Verma');
  const [supervisorPhone, setSupervisorPhone] = useState('9820198201');

  // Step 3: Duties, Skills & Eligibility
  const [duties, setDuties] = useState('Scan visitor passes at entry, distribute exhibitor guide booklets, guide delegates to Hall 4');
  const [requiredSkills, setRequiredSkills] = useState('Customer Service, Fluent Hindi/English, Basic Smartphone Operation');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('Must be 18+ years old. Punctuality is strictly required.');
  const [dressCode, setDressCode] = useState('Smart casuals or black collared polo. Dark formal trousers with closed-toe shoes.');

  // Step 4: Wages, Benefits & Terms
  const [hourlyRate, setHourlyRate] = useState('175');
  const [breaksMinutes, setBreaksMinutes] = useState('45');
  const [mealProvided, setMealProvided] = useState(true);
  const [transportProvided, setTransportProvided] = useState(false);
  const [overtimePolicy, setOvertimePolicy] = useState('₹190/hr for additional show hours if requested on-site.');
  const [cancellationPolicy, setCancellationPolicy] = useState(
    'Free cancellation up to 24 hours prior to shift commencement. Emergency cancellations require 12 hours notice.'
  );

  // Calculations
  const parsedRate = parseFloat(hourlyRate) || 0;
  const parsedHours = parseFloat(durationHours) || 0;
  const parsedSlots = parseInt(slotsTotal, 10) || 0;
  const perWorkerPay = parsedRate * parsedHours;
  const financials = calculateJobFinancials(parsedSlots, perWorkerPay);
  const totalCrewBudget = financials.totalWorkerWages;
  const platformFee = financials.platformFeeAmount;
  const gstFee = financials.gstAmount;
  const totalDeposit = financials.totalPayableByOrganizer;

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (title.trim().length < 5) {
        Alert.alert('Validation Error', 'Shift title must be at least 5 characters long.');
        return false;
      }
      if (parsedSlots < 1) {
        Alert.alert('Validation Error', 'Headcount must be at least 1 worker.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!venueName.trim() || !venueAddress.trim()) {
        Alert.alert('Validation Error', 'Please specify both venue name and full address.');
        return false;
      }
      if (parsedHours <= 0) {
        Alert.alert('Validation Error', 'Duration hours must be greater than 0.');
        return false;
      }
      if (!supervisorName.trim() || !supervisorPhone.trim()) {
        Alert.alert('Validation Error', 'On-site supervisor contact information is required.');
        return false;
      }
    } else if (currentStep === 3) {
      if (duties.trim().length < 10) {
        Alert.alert('Validation Error', 'Please list shift duties with at least 10 characters.');
        return false;
      }
    } else if (currentStep === 4) {
      if (parsedRate < 100) {
        Alert.alert('Validation Error', 'Minimum wage is ₹100 per hour.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (status: 'open' | 'draft') => {
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

    const payload = {
      title,
      category,
      venueName,
      venueAddress,
      landmark: landmark.trim() || undefined,
      city: 'Mumbai',
      zone,
      date,
      startTime,
      endTime,
      durationHours: parsedHours,
      hourlyRate: parsedRate,
      slotsTotal: parsedSlots,
      dressCode,
      duties: dutiesArray,
      requiredSkills: skillsArray,
      eligibilityCriteria,
      breaksMinutes: parseInt(breaksMinutes, 10) || 30,
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
      Alert.alert('Validation Error', issue);
      return;
    }

    const organizerId = session?.user?.id || 'org-apex-01';

    const result = await createJobSafe(
      {
        ...payload,
        totalPay: perWorkerPay,
      },
      organizerId
    );

    setSubmitting(false);

    if (result.success) {
      Alert.alert(
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
    } else {
      Alert.alert('Submission Error', result.error || 'Failed to create shift.');
    }
  };

  const progressPercent = Math.round((step / 5) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Wizard Header with Progress */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {WIZARD_STEPS[step - 1].title}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Step {step} of 5 • {WIZARD_STEPS[step - 1].subtitle}
            </Text>
          </View>
          <Badge label={`STEP ${step}/5`} variant="primary" size="sm" />
        </View>

        {/* Progress Track */}
        <View style={[styles.progressBarBackground, { backgroundColor: colors.surfaceMuted, marginTop: 12 }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: ROLE & CATEGORY */}
        {step === 1 && (
          <View style={{ gap: spacing.md }}>
            <Input
              label="Shift Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. VIP Registration Host & Usher"
              helperText="Clear, descriptive role title visible to applicants"
            />

            <View>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                Event Category
              </Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value;
                  return (
                    <Pressable
                      key={cat.value}
                      onPress={() => setCategory(cat.value)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label="Headcount Required (Positions)"
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              keyboardType="number-pad"
              placeholder="e.g. 8"
              helperText="Number of verified workers needed for this shift"
            />
          </View>
        )}

        {/* STEP 2: SCHEDULE & VENUE */}
        {step === 2 && (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Event Date (YYYY-MM-DD)"
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-10-15"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Duration (Hours)"
                  value={durationHours}
                  onChangeText={setDurationHours}
                  keyboardType="numeric"
                  placeholder="9"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Time (HH:MM)"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Time (HH:MM)"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>

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

            <View>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                Mumbai Locality Zone
              </Text>
              <View style={styles.categoryGrid}>
                {MUMBAI_ZONES.map((z) => {
                  const isSelected = zone === z;
                  return (
                    <Pressable
                      key={z}
                      onPress={() => setZone(z)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary, fontSize: 12 },
                        ]}
                      >
                        {z}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label="Reporting Instructions for Workers"
              value={reportingInstructions}
              onChangeText={setReportingInstructions}
              placeholder="Where workers should report and who to meet"
              multiline
              numberOfLines={2}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Supervisor Name"
                  value={supervisorName}
                  onChangeText={setSupervisorName}
                  placeholder="e.g. Rohit Verma"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Supervisor Phone"
                  value={supervisorPhone}
                  onChangeText={setSupervisorPhone}
                  keyboardType="phone-pad"
                  placeholder="e.g. 9820198201"
                />
              </View>
            </View>
          </View>
        )}

        {/* STEP 3: DUTIES, SKILLS & ELIGIBILITY */}
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
              helperText="Keywords matched against worker profiles"
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

        {/* STEP 4: WAGES, BREAKS & PAYMENT TERMS */}
        {step === 4 && (
          <View style={{ gap: spacing.md }}>
            <Input
              label="Hourly Wage per Worker (₹ / hr)"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              placeholder="175"
              helperText="Wages are deposited into direct settlement upon shift sign-off"
            />

            {/* Quick Financial Preview */}
            <Card variant="elevated" style={{ backgroundColor: colors.surfaceMuted, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Per Worker Pay:</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                  {formatINR(perWorkerPay)} ({parsedHours}h @ {formatINR(parsedRate)}/h)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Total Crew Wages ({parsedSlots} workers):</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>
                  {formatINR(totalCrewBudget)}
                </Text>
              </View>
            </Card>

            <Input
              label="Rest Breaks (Minutes)"
              value={breaksMinutes}
              onChangeText={setBreaksMinutes}
              keyboardType="number-pad"
              placeholder="45"
            />

            {/* Switches for meals & transport */}
            <Card variant="outlined" style={{ gap: spacing.md, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                    Meal Provided on-site
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Lunch or dinner provided during break</Text>
                </View>
                <Switch
                  value={mealProvided}
                  onValueChange={setMealProvided}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={{ height: 1, backgroundColor: colors.border }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                    Travel / Cab Allowance
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>Reimbursement or transport arranged</Text>
                </View>
                <Switch
                  value={transportProvided}
                  onValueChange={setTransportProvided}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>

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

        {/* STEP 5: FINAL REVIEW & PUBLICATION */}
        {step === 5 && (
          <View style={{ gap: spacing.md }}>
            {/* Shift Role Card */}
            <Card variant="elevated">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    Category: {category.toUpperCase()} • {parsedSlots} positions
                  </Text>
                </View>
                <Badge label="READY TO PUBLISH" variant="success" size="sm" />
              </View>
            </Card>

            {/* Schedule & Venue Card */}
            <Card variant="outlined" style={{ gap: 8 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Event & Venue</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                📅 {date} • {startTime} - {endTime} ({parsedHours} hours)
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                📍 {venueName}, {zone}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>{venueAddress}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                👤 Supervisor: {supervisorName} ({supervisorPhone})
              </Text>
            </Card>

            {/* Comprehensive Financial Budget Card */}
            <Card
              variant="outlined"
              style={{
                borderColor: colors.primary,
                borderWidth: 1.5,
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                gap: 8,
              }}
            >
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Financial Summary & Budget
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Total Worker Wages ({parsedSlots} × {formatINR(perWorkerPay)}):
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                  {formatINR(totalCrewBudget)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>Platform Facilitation Fee (8%):</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {formatINR(platformFee)}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>GST on Fee (18%):</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {formatINR(gstFee)}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Total Organizer Liability:
                </Text>
                <WageText style={{ fontSize: 20 }}>{formatINR(totalDeposit)}</WageText>
              </View>
            </Card>

            {/* Conditions Card */}
            <Card variant="outlined" style={{ gap: 6 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>Conditions</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                ☕ Breaks: {breaksMinutes} mins • Meals: {mealProvided ? 'Yes' : 'No'} • Travel: {transportProvided ? 'Yes' : 'No'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                👔 Dress Code: {dressCode}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
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
            <Button
              title="← Back"
              variant="outline"
              size="md"
              onPress={handleBack}
            />
          </View>
        ) : null}

        {step < 5 ? (
          <View style={{ flex: 2 }}>
            <Button
              title="Continue →"
              variant="primary"
              size="md"
              onPress={handleNext}
            />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
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
