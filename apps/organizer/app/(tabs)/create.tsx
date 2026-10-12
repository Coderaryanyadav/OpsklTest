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
  ShiftStatus,
  formatINR,
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

const STEP_TITLES = [
  'Role & Category',
  'Required Headcount',
  'Schedule & Hours',
  'Venue & Locality',
  'Responsibilities & Eligibility',
  'Wage & Escrow Budget',
  'Working Conditions',
  'Dress Code & Contact',
  'Application Cutoff',
  'Cancellation Policy',
  'Review & Publish',
];

export default function OrganizerCreateShiftScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields (Steps 1 to 10)
  // Step 1: Title & Category
  const [title, setTitle] = useState('Registration Desk & Usher');
  const [category, setCategory] = useState<ShiftCategory>('exhibition');

  // Step 2: Headcount
  const [slotsTotal, setSlotsTotal] = useState('8');

  // Step 3: Date & Times
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [durationHours, setDurationHours] = useState('9');

  // Step 4: Venue & Locality
  const [venueName, setVenueName] = useState('Bombay Exhibition Centre (NESCO)');
  const [venueAddress, setVenueAddress] = useState('Western Express Highway, Goregaon East, Mumbai 400063');
  const [landmark, setLandmark] = useState('Near Ram Mandir Station');
  const [zone, setZone] = useState('Goregaon & NESCO');

  // Step 5: Duties & Eligibility
  const [duties, setDuties] = useState('Scan visitor passes at entry, distribute exhibitor guide booklets, guide delegates to Hall 4');
  const [requiredSkills, setRequiredSkills] = useState('Customer Service, Fluent Hindi/English, Basic Smartphone Operation');
  const [eligibilityCriteria, setEligibilityCriteria] = useState('Must be 18+ years old. Punctuality is strictly required.');

  // Step 6: Pay & Escrow
  const [hourlyRate, setHourlyRate] = useState('175');
  const [paymentDeadline, setPaymentDeadline] = useState('2026-10-25');

  // Step 7: Working Conditions
  const [breaksMinutes, setBreaksMinutes] = useState('45');
  const [mealProvided, setMealProvided] = useState(true);
  const [transportProvided, setTransportProvided] = useState(false);
  const [overtimePolicy, setOvertimePolicy] = useState('₹190/hr for additional show hours if requested on-site.');

  // Step 8: Dress Code & Supervisor
  const [dressCode, setDressCode] = useState('Smart casuals or black collared polo. Dark formal jeans or trousers with closed-toe shoes.');
  const [reportingInstructions, setReportingInstructions] = useState('Report to Exhibitor Gate 2 by 8:30 AM for on-site badge issue and morning briefing.');
  const [supervisorName, setSupervisorName] = useState('Rohit Verma');
  const [supervisorPhone, setSupervisorPhone] = useState('9820198201');

  // Step 9: Application Cutoff
  const [applicationDeadline, setApplicationDeadline] = useState('2026-10-18T18:00:00Z');

  // Step 10: Cancellation Policy
  const [cancellationPolicy, setCancellationPolicy] = useState(
    'Free cancellation up to 24 hours prior to shift commencement. Emergency cancellations require 12 hours notice.'
  );

  // Financial calculations
  const parsedRate = parseFloat(hourlyRate) || 0;
  const parsedHours = parseFloat(durationHours) || 0;
  const parsedSlots = parseInt(slotsTotal, 10) || 0;
  const perWorkerPay = parsedRate * parsedHours;
  const financials = calculateJobFinancials(parsedSlots, perWorkerPay);
  const totalCrewBudget = financials.totalWorkerWages;
  const platformFee = financials.platformFeeAmount;
  const gstFee = financials.gstAmount;
  const totalDeposit = financials.totalPayableByOrganizer;

  const validateCurrentStep = (): boolean => {
    if (step === 1) {
      if (title.trim().length < 5) {
        Alert.alert('Validation Error', 'Shift title must be at least 5 characters');
        return false;
      }
    } else if (step === 2) {
      if (parsedSlots < 1) {
        Alert.alert('Validation Error', 'Headcount must be at least 1 worker');
        return false;
      }
    } else if (step === 3) {
      if (date < todayStr) {
        Alert.alert('Validation Error', 'Shift date cannot be in the past');
        return false;
      }
      if (parsedHours < 3 || parsedHours > 14) {
        Alert.alert('Validation Error', 'Shift duration must be between 3 and 14 hours');
        return false;
      }
    } else if (step === 4) {
      if (venueName.trim().length < 3) {
        Alert.alert('Validation Error', 'Venue name is required');
        return false;
      }
      if (venueAddress.trim().length < 10) {
        Alert.alert('Validation Error', 'Full venue street address is required');
        return false;
      }
    } else if (step === 5) {
      if (duties.trim().length < 5) {
        Alert.alert('Validation Error', 'Specify shift responsibilities');
        return false;
      }
    } else if (step === 6) {
      if (parsedRate < 100) {
        Alert.alert('Validation Error', 'Minimum allowable wage in India is ₹100/hr');
        return false;
      }
    } else if (step === 8) {
      if (supervisorName.trim().length < 2) {
        Alert.alert('Validation Error', 'Supervisor contact name is required');
        return false;
      }
      if (!/^[6-9]\d{9}$/.test(supervisorPhone.trim())) {
        Alert.alert('Validation Error', 'Valid 10-digit Indian phone number required for supervisor');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((prev) => Math.min(11, prev + 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSave = async (status: ShiftStatus) => {
    setSubmitting(true);

    const dutiesArray = duties.split(',').map((d) => d.trim()).filter(Boolean);
    const skillsArray = requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);

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
      applicationDeadline,
      paymentDeadline,
      supervisorName,
      supervisorPhone: supervisorPhone.trim(),
      status,
    };

    // Client-side Zod Schema validation
    const validationResult = ShiftCreateSchema.safeParse(payload);
    if (!validationResult.success) {
      setSubmitting(false);
      const issue = validationResult.error.issues[0]?.message || 'Validation failed';
      Alert.alert('Validation Error', issue);
      return;
    }

    const organizerId = session?.user?.id || 'org-apex-01';

    // Server-side creation via safe RPC
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
          : `Your shift for ${parsedSlots} workers has been published to the Opskl Mumbai marketplace.`,
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

  const progressPercent = Math.round((step / 11) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Top Wizard Header */}
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
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' }}>
              STEP {step} OF 11 • {progressPercent}%
            </Text>
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 2 }]}>
              {STEP_TITLES[step - 1]}
            </Text>
          </View>

          <Badge label="MUMBAI" variant="success" size="sm" />
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted, borderRadius: radii.full }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primary,
                borderRadius: radii.full,
              },
            ]}
          />
        </View>
      </View>

      {/* Wizard Step Body */}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* STEP 1: Title & Category */}
        {step === 1 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Shift Title & Category
            </Text>
            <Input
              label="Shift Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Registration Desk & VIP Usher"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.md, marginBottom: 8 }}>
              Event Category
            </Text>
            <View style={styles.chipsRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <Pressable
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textSecondary,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* STEP 2: Headcount */}
        {step === 2 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Headcount Requirement
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              How many individual workers do you need for this single shift?
            </Text>
            <Input
              label="Number of Workers"
              value={slotsTotal}
              onChangeText={setSlotsTotal}
              keyboardType="number-pad"
              placeholder="e.g. 8"
            />
          </Card>
        )}

        {/* STEP 3: Date & Schedule */}
        {step === 3 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Shift Schedule
            </Text>
            <Input
              label="Event Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              placeholder="2026-10-20"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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
              label="Duration (Hours)"
              value={durationHours}
              onChangeText={setDurationHours}
              keyboardType="numeric"
              placeholder="9"
            />
          </Card>
        )}

        {/* STEP 4: Venue & Locality */}
        {step === 4 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Venue Location
            </Text>
            <Input
              label="Venue Name"
              value={venueName}
              onChangeText={setVenueName}
              placeholder="e.g. Jio World Convention Centre"
            />
            <Input
              label="Full Street Address"
              value={venueAddress}
              onChangeText={setVenueAddress}
              placeholder="G Block BKC, Bandra East, Mumbai 400098"
            />
            <Input
              label="Landmark (Optional)"
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Opposite Bharat Diamond Bourse"
            />

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.md, marginBottom: 8 }}>
              Mumbai Locality Zone
            </Text>
            <View style={styles.chipsRow}>
              {MUMBAI_ZONES.map((z) => {
                const isSelected = zone === z;
                return (
                  <Pressable
                    key={z}
                    onPress={() => setZone(z)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textSecondary,
                      }}
                    >
                      {z}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* STEP 5: Responsibilities & Eligibility */}
        {step === 5 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Responsibilities & Criteria
            </Text>
            <Input
              label="Key Duties (comma separated)"
              value={duties}
              onChangeText={setDuties}
              multiline
              numberOfLines={3}
              placeholder="Scan badges, Issue delegate kits, Direct visitors"
            />
            <Input
              label="Required Skills (comma separated)"
              value={requiredSkills}
              onChangeText={setRequiredSkills}
              placeholder="Guest Relations, Fluent English, Tech Friendly"
            />
            <Input
              label="Eligibility Requirements"
              value={eligibilityCriteria}
              onChangeText={setEligibilityCriteria}
              placeholder="Must be 18+ years old, prior exhibition experience preferred"
            />
          </Card>
        )}

        {/* STEP 6: Wage & Escrow */}
        {step === 6 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Wage & Escrow Budget
            </Text>
            <Input
              label="Hourly Pay per Worker (₹ INR, min 100)"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              placeholder="175"
            />
            <Input
              label="Payment / Settlement Deadline (YYYY-MM-DD)"
              value={paymentDeadline}
              onChangeText={setPaymentDeadline}
              placeholder="2026-10-25"
            />

            <View style={[styles.budgetBox, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Per Worker Payout:</Text>
                <Text style={styles.budgetValue}>{formatINR(perWorkerPay)} ({parsedHours}h)</Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Crew Wages (100% pass-through):</Text>
                <Text style={styles.budgetValue}>{formatINR(totalCrewBudget)}</Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Opskl Platform Fee (10%):</Text>
                <Text style={styles.budgetValue}>{formatINR(platformFee)}</Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>GST on Fee (18% SAC 998519):</Text>
                <Text style={styles.budgetValue}>{formatINR(gstFee)}</Text>
              </View>
              <View style={[styles.budgetRow, styles.budgetTotalRow]}>
                <Text style={[styles.budgetLabel, { fontWeight: '700', color: colors.textPrimary }]}>
                  Total Escrow Deposit:
                </Text>
                <WageText>{formatINR(totalDeposit)}</WageText>
              </View>
            </View>
          </Card>
        )}

        {/* STEP 7: Working Conditions */}
        {step === 7 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Working Conditions & Perks
            </Text>
            <Input
              label="Total Breaks (Minutes)"
              value={breaksMinutes}
              onChangeText={setBreaksMinutes}
              keyboardType="number-pad"
              placeholder="45"
            />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Meals Provided on-site
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Lunch / refreshments catered by organizer
                </Text>
              </View>
              <Switch value={mealProvided} onValueChange={setMealProvided} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>

            <View style={[styles.switchRow, { marginTop: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  Travel Allowance / Transport
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Cab / travel stipend included
                </Text>
              </View>
              <Switch value={transportProvided} onValueChange={setTransportProvided} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Input
                label="Overtime Policy"
                value={overtimePolicy}
                onChangeText={setOvertimePolicy}
                placeholder="₹200/hr for additional show hours"
              />
            </View>
          </Card>
        )}

        {/* STEP 8: Dress Code & Supervisor */}
        {step === 8 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Dress Code & On-site Supervisor
            </Text>
            <Input
              label="Dress Code & Grooming"
              value={dressCode}
              onChangeText={setDressCode}
              placeholder="Black formal shirt, dark trousers, formal shoes"
            />
            <Input
              label="Reporting Instructions"
              value={reportingInstructions}
              onChangeText={setReportingInstructions}
              placeholder="Report to Gate 2 by 8:30 AM"
            />
            <Input
              label="Supervisor Name"
              value={supervisorName}
              onChangeText={setSupervisorName}
              placeholder="Rohit Verma"
            />
            <Input
              label="Supervisor Mobile Number"
              value={supervisorPhone}
              onChangeText={setSupervisorPhone}
              keyboardType="phone-pad"
              placeholder="9820198201"
            />
          </Card>
        )}

        {/* STEP 9: Application Cutoff */}
        {step === 9 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
              Application Deadline
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>
              When should marketplace applications close for selection?
            </Text>
            <Input
              label="Application Cutoff ISO / Date"
              value={applicationDeadline}
              onChangeText={setApplicationDeadline}
              placeholder="2026-10-18T18:00:00Z"
            />
          </Card>
        )}

        {/* STEP 10: Cancellation Policy */}
        {step === 10 && (
          <Card variant="outlined">
            <Text style={[typography.subtitle, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Shift Cancellation Policy
            </Text>
            <Input
              label="Cancellation Terms"
              value={cancellationPolicy}
              onChangeText={setCancellationPolicy}
              multiline
              numberOfLines={3}
            />
          </Card>
        )}

        {/* STEP 11: Final Review & Publication */}
        {step === 11 && (
          <Card variant="elevated">
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
              Final Shift Review
            </Text>

            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Role:</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Category:</Text>
              <Text style={styles.reviewValue}>{category.toUpperCase()}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Headcount:</Text>
              <Text style={styles.reviewValue}>{parsedSlots} workers</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Date & Time:</Text>
              <Text style={styles.reviewValue}>{date} • {startTime} - {endTime} ({parsedHours}h)</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Venue:</Text>
              <Text style={styles.reviewValue}>{venueName}, {zone}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Rate & Per Worker:</Text>
              <Text style={styles.reviewValue}>{formatINR(parsedRate)}/hr → {formatINR(perWorkerPay)}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Crew Wages:</Text>
              <Text style={styles.reviewValue}>{formatINR(totalCrewBudget)}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Fee & GST (18%):</Text>
              <Text style={styles.reviewValue}>{formatINR(platformFee + gstFee)}</Text>
            </View>
            <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
              <Text style={styles.reviewLabel}>Total Escrow Deposit:</Text>
              <Text style={[styles.reviewValue, { fontWeight: '800', color: colors.primary }]}>
                {formatINR(totalDeposit)}
              </Text>
            </View>

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title="🚀 Publish Shift to Workers"
                variant="primary"
                size="lg"
                loading={submitting}
                onPress={() => handleSave('open')}
              />
              <Button
                title="💾 Save as Draft"
                variant="secondary"
                size="md"
                loading={submitting}
                onPress={() => handleSave('draft')}
              />
            </View>
          </Card>
        )}

        {/* Wizard Step Navigation Footer */}
        <View style={styles.navRow}>
          {step > 1 && (
            <View style={{ flex: 1 }}>
              <Button title="← Back" variant="outline" size="md" onPress={handleBack} />
            </View>
          )}
          {step < 11 && (
            <View style={{ flex: 1 }}>
              <Button title="Next →" variant="primary" size="md" onPress={handleNext} />
            </View>
          )}
        </View>
      </ScrollView>
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
  progressTrack: {
    height: 6,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetBox: {
    padding: 12,
    marginTop: 14,
    gap: 6,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetTotalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#94A3B8',
  },
  budgetLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  budgetValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingBottom: 24,
  },
});
