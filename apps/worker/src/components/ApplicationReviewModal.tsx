import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOpsklTheme, Button, Badge } from '@opskil/design-system';
import { Job, WorkerProfile, formatINR, formatISTDate } from '@opskil/shared';
import {
  X,
  MapPin,
  Calendar,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
  Lock,
  FileCheck,
} from 'lucide-react-native';

export interface ApplicationReviewModalProps {
  visible: boolean;
  shift: Job;
  workerProfile: WorkerProfile | null;
  submitting: boolean;
  isApplied: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onNavigateDiscover: () => void;
  onNavigateMyShifts: () => void;
}

export function ApplicationReviewModal({
  visible,
  shift,
  workerProfile,
  submitting,
  isApplied,
  onClose,
  onSubmit,
  onNavigateDiscover,
  onNavigateMyShifts,
}: ApplicationReviewModalProps) {
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const [availabilityConfirmed, setAvailabilityConfirmed] = useState(true);

  const totalPay = shift.totalPay || (shift.hourlyRate * shift.durationHours);
  const userPhone = workerProfile?.profile?.phone;
  const maskedPhone = userPhone && userPhone.length > 5
    ? `${userPhone.slice(0, 5)} •••••`
    : '+91 98201 •••••';

  const maskedAadhaar = '•••• •••• 8291';
  const workerFullName = workerProfile?.profile?.fullName || 'Verified Worker';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        {/* Modal Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close application review"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
            <View>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                {isApplied ? 'Application Status' : 'Review & Submit'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {isApplied ? 'Truthful Lifecycle Tracking' : 'Step 2 of 2 • Gig Roster Dispatch'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {/* Top Progress / Phase Indicator */}
          {!isApplied && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 }}>
                  Step 2 of 2 • Review & Dispatch
                </Text>
                <Badge label="GIG ROSTER" variant="primary" size="sm" />
              </View>
              <View style={{ height: 4, backgroundColor: colors.surfaceMuted, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: '100%', height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
            </View>
          )}

          {/* Shift Snapshot Card */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge label={shift.category.toUpperCase()} variant="neutral" size="sm" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                  {shift.slotsTotal - shift.slotsFilled} SLOTS OPEN
                </Text>
              </View>
            </View>

            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: 4 }]}>
              {shift.title}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
              {shift.organizer?.businessName || 'Verified Corporate Enterprise'}
            </Text>

            <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 10, marginTop: 6, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  {shift.venueName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {formatISTDate(shift.date)} • {shift.startTime} – {shift.endTime} IST ({shift.durationHours} hrs)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 6, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <IndianRupee size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>Guaranteed Net Shift Pay</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>
                  {formatINR(totalPay)}
                </Text>
              </View>
            </View>
          </View>

          {/* POST-SUBMISSION STATUS CARD (Shown when already applied) */}
          {isApplied ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xl }]}>
              {/* Status Header Badge & Ref */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    APPLICATION SUBMITTED • PENDING REVIEW
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: colors.textSecondary }}>
                  #APP-BOM-{shift.id.slice(0, 4).toUpperCase()}
                </Text>
              </View>

              {/* Confirmation Delivery Feedback */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, padding: 12, borderRadius: radii.md, marginTop: 4 }}>
                <View style={{ width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Delivered to {shift.organizer?.businessName || 'Apex Live'} Desk
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    Submitted Today • IST Roster Queue
                  </Text>
                </View>
              </View>

              {/* Explanatory Message */}
              <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>
                Your profile has been delivered to <Text style={{ fontWeight: '700' }}>{shift.organizer?.businessName || 'the organizer'}</Text> desk. Organizers typically review and respond within <Text style={{ fontWeight: '700', color: colors.primary }}>2-4 hours</Text>. Submitting does not guarantee hiring.
              </Text>

              {/* Operational Timeline Trace */}
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={16} color={colors.primary} strokeWidth={2.5} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Step 1: Application Received & Logged
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Step 2: Roster Manager Screening Profile Fit
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                  <Lock size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Step 3: Offer Notification & Worker Confirmation
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={{ gap: 8, marginTop: 4 }}>
                <Button
                  title="Browse More Shifts"
                  variant="primary"
                  size="lg"
                  onPress={onNavigateDiscover}
                />
                <Button
                  title="View in My Shifts"
                  variant="outline"
                  size="lg"
                  onPress={onNavigateMyShifts}
                />
              </View>
            </View>
          ) : (
            <>
              {/* Verification & Profile Checklist */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Verification & Profile Checklist
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                    READY TO SUBMIT
                  </Text>
                </View>

                <View style={{ gap: 8 }}>
                  {/* Checklist 1: Profile & Contact */}
                  <View style={[styles.checklistItem, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
                    <CheckCircle2 size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Profile & Contact Details
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {workerFullName} • {maskedPhone}
                      </Text>
                    </View>
                    <Badge label="COMPLETE" variant="primary" size="sm" />
                  </View>

                  {/* Checklist 2: Locality Match */}
                  <View style={[styles.checklistItem, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
                    <MapPin size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Preferred Locality Match
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        Matches {shift.zone || 'Mumbai'} dispatch area
                      </Text>
                    </View>
                    <Badge label="ZONE PINNED" variant="neutral" size="sm" />
                  </View>

                  {/* Checklist 3: Language Competency */}
                  <View style={[styles.checklistItem, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
                    <CheckCircle2 size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Language Competency
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        English (Fluent) & Hindi (Conversational)
                      </Text>
                    </View>
                    <Badge label="VERIFIED" variant="primary" size="sm" />
                  </View>

                  {/* Checklist 4: KYC Documentation */}
                  <View style={[styles.checklistItem, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
                    <FileCheck size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        KYC Documentation
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        Aadhaar ({maskedAadhaar})
                      </Text>
                    </View>
                    <Badge
                      label={workerProfile?.verificationStatus === 'verified' ? 'APPROVED' : 'UNDER REVIEW'}
                      variant={workerProfile?.verificationStatus === 'verified' ? 'success' : 'neutral'}
                      size="sm"
                    />
                  </View>
                </View>
              </View>

              {/* Important Truthful Notice Box */}
              <View style={[styles.noticeBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.lg }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Truthful Application Terms
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 }}>
                  Submitting an application registers your interest with <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{shift.organizer?.businessName || 'the organizer'}</Text>. Organizers shortlist and select candidates based on event role fit. Applying does NOT confirm booking or guarantee wages. You will be notified if selected, after which you must confirm your slot.
                </Text>
              </View>

              {/* Worker Availability Declaration */}
              <Pressable
                onPress={() => setAvailabilityConfirmed(!availabilityConfirmed)}
                style={[
                  styles.declarationRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: availabilityConfirmed ? colors.primary : 'transparent',
                      borderColor: availabilityConfirmed ? colors.primary : colors.border,
                      borderRadius: 4,
                    },
                  ]}
                >
                  {availabilityConfirmed && <CheckCircle2 size={14} color={colors.textInverse} />}
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: colors.textPrimary, lineHeight: 18 }}>
                  I confirm availability for the full {shift.durationHours}-hour shift on <Text style={{ fontWeight: '700' }}>{formatISTDate(shift.date)}</Text> in <Text style={{ fontWeight: '700' }}>{shift.dressCode || 'required attire'}</Text> at {shift.venueName}.
                </Text>
              </Pressable>

              {/* Submit Button with Double-Tap Prevention */}
              <View style={{ gap: 8, marginTop: 4 }}>
                <Button
                  title={submitting ? 'Transmitting Application…' : 'Transmit Application'}
                  variant="primary"
                  size="lg"
                  disabled={!availabilityConfirmed || submitting}
                  loading={submitting}
                  onPress={onSubmit}
                  icon={!submitting ? <Send size={16} color={colors.textInverse} /> : undefined}
                />
              </View>
            </>
          )}

          {/* Security & Tokenization Stamp */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
            <ShieldCheck size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Aadhaar Tokenized • Geofence Verified Hub
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  noticeBox: {
    padding: 12,
    borderWidth: 1,
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
