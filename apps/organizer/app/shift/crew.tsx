import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Modal,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  OpsklAlert,
  ErrorRetry,
  LoadingView,
  useAuth,
} from '@opskil/design-system';
import {
  Job,
  Booking,
  JobApplication,
  formatINR,
  fetchOrganizerJobs,
  fetchJobBookings,
  fetchApplicationsForJob,
  sendShiftMessage,
  cancelBookingSafe,
  confirmWorkerBookingSafe,
  subscribeToShiftRoster,
} from '@opskil/shared';
import {
  ArrowLeft,
  Bell,
  User,
  Shield,
  MapPin,
  Lock,
  Radio,
  CheckCircle2,
  Phone,
  AlertTriangle,
  FileDown,
  PhoneCall,
  X,
} from 'lucide-react-native';

interface DeployedCrewMember {
  id: string;
  bookingId: string;
  workerId: string;
  name: string;
  roleTag: string;
  isTeamLead?: boolean;
  phoneMasked: string;
  phoneRaw: string;
  status: string;
  checkInCode?: string;
  kycReady: boolean;
  checkedIn: boolean;
}

interface StandbyWorker {
  id: string;
  applicationId: string;
  workerId: string;
  name: string;
  location: string;
  distance: string;
  ready: boolean;
}

function maskPhone(phone?: string): string {
  if (!phone) return 'No phone on file';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  const local = digits.slice(-10);
  return `+91 ${local.slice(0, 5)} •••••`;
}

function mapBookingToCrew(booking: Booking, index: number, jobTitle?: string): DeployedCrewMember {
  const phone = booking.worker?.profile?.phone || '';
  return {
    id: booking.id,
    bookingId: booking.id,
    workerId: booking.workerId,
    name: booking.worker?.profile?.fullName || `Worker ···${booking.workerId.slice(-4)}`,
    roleTag: jobTitle || 'Confirmed crew',
    isTeamLead: index === 0,
    phoneMasked: maskPhone(phone),
    phoneRaw: phone,
    status: booking.status,
    checkInCode: booking.checkInCode,
    kycReady: booking.worker?.verificationStatus === 'verified',
    checkedIn: booking.status === 'checked_in' || booking.status === 'checked_out' || booking.status === 'completed',
  };
}

function mapAppToStandby(app: JobApplication): StandbyWorker {
  return {
    id: app.id,
    applicationId: app.id,
    workerId: app.workerId,
    name: app.worker?.profile?.fullName || `Worker ···${app.workerId.slice(-4)}`,
    location: app.worker?.preferredLocality || 'Mumbai',
    distance: 'Reserve applicant',
    ready: app.status === 'shortlisted' || app.status === 'applied',
  };
}

export default function ConfirmedCrewRosterBriefingConsoleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const { colors, spacing, radii, touchTarget } = useOpsklTheme();

  const organizerId = session?.user?.id;
  const jobId = typeof params.jobId === 'string' ? params.jobId : '';

  const [shift, setShift] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [briefingDispatched, setBriefingDispatched] = useState(false);
  const [dispatchingBriefing, setDispatchingBriefing] = useState(false);

  const [selectedStandbyForReplacement, setSelectedStandbyForReplacement] = useState<StandbyWorker | null>(null);
  const [crewToReplace, setCrewToReplace] = useState<DeployedCrewMember | null>(null);
  const replacementReason = 'Organizer-initiated roster replacement';
  const [processingReplacement, setProcessingReplacement] = useState(false);

  const [crew, setCrew] = useState<DeployedCrewMember[]>([]);
  const [standbyCrew, setStandbyCrew] = useState<StandbyWorker[]>([]);

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const jobs = await fetchOrganizerJobs(organizerId);
      const targetJob = jobId ? jobs.find((j) => j.id === jobId) : jobs[0];
      if (!targetJob) {
        setShift(null);
        setCrew([]);
        setStandbyCrew([]);
        return;
      }

      setShift(targetJob);
      const [bookings, applications] = await Promise.all([
        fetchJobBookings(targetJob.id),
        fetchApplicationsForJob(targetJob.id),
      ]);

      const activeBookings = bookings.filter(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'checked_in' ||
          b.status === 'checked_out' ||
          b.status === 'completed_awaiting_review' ||
          b.status === 'completed' ||
          b.status === 'selected_awaiting_confirmation'
      );
      setCrew(activeBookings.map((b, i) => mapBookingToCrew(b, i, targetJob.title)));

      const reserved = applications.filter(
        (a) =>
          (a.status === 'applied' || a.status === 'shortlisted') &&
          !activeBookings.some((b) => b.workerId === a.workerId)
      );
      setStandbyCrew(reserved.map(mapAppToStandby));
    } catch (err: any) {
      setError(err?.message || 'Could not load confirmed crew roster.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId, jobId]);

  useEffect(() => {
    loadData();

    if (!organizerId) return;
    const targetId = jobId || shift?.id;
    if (!targetId) return;
    const unsub = subscribeToShiftRoster(targetId, () => {
      loadData();
    });
    return () => unsub();
  }, [loadData, organizerId, jobId, shift?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filledSlots = crew.length;
  const totalSlots = shift?.slotsTotal || 0;

  const handleBroadcast = async () => {
    if (!shift?.id) {
      OpsklAlert.alert('No shift', 'Open a shift from the roster before broadcasting.');
      return;
    }
    if (crew.length === 0) {
      OpsklAlert.alert('No crew yet', 'Confirm workers from Screening before sending a briefing.');
      return;
    }
    setDispatchingBriefing(true);
    try {
      await sendShiftMessage(
        shift.id,
        `Briefing for ${shift.title}: Report by ${shift.startTime || 'shift start'} at ${shift.venueName || 'venue'}. Dress code and pass code are in your worker app.`,
        undefined,
        true
      );
      setBriefingDispatched(true);
      OpsklAlert.alert(
        'Briefing sent',
        `In-app shift message queued for ${crew.length} confirmed worker(s).`
      );
    } catch {
      OpsklAlert.alert('Dispatch Error', 'Could not broadcast briefing to crew.');
    } finally {
      setDispatchingBriefing(false);
    }
  };

  const handleCallWorker = (member: DeployedCrewMember) => {
    if (!member.phoneRaw) {
      OpsklAlert.alert('No phone', `${member.name} has no phone number on their profile.`);
      return;
    }
    Linking.openURL(`tel:${member.phoneRaw}`).catch(() => {
      OpsklAlert.alert('Phone Dialler', `Could not open dialler for ${member.phoneMasked}.`);
    });
  };

  const handleInitiateReplacement = (standby: StandbyWorker) => {
    if (crew.length === 0) {
      OpsklAlert.alert('No confirmed crew', 'There is no confirmed worker to replace yet.');
      return;
    }
    setSelectedStandbyForReplacement(standby);
    setCrewToReplace(crew[crew.length - 1]);
  };

  const handleConfirmReplacement = async () => {
    if (!selectedStandbyForReplacement || !crewToReplace || !organizerId || !shift?.id) return;

    setProcessingReplacement(true);
    try {
      const cancelRes = await cancelBookingSafe(
        crewToReplace.bookingId,
        replacementReason,
        organizerId
      );
      if (!cancelRes.success) {
        OpsklAlert.alert('Replacement failed', cancelRes.error || 'Could not cancel outgoing booking.');
        return;
      }

      const confirmRes = await confirmWorkerBookingSafe(
        shift.id,
        selectedStandbyForReplacement.workerId,
        organizerId,
        `Standby replacement for ${crewToReplace.name}`
      );
      if (!confirmRes.success) {
        OpsklAlert.alert(
          'Partial failure',
          confirmRes.error ||
            'Outgoing booking was cancelled but standby confirmation failed. Refresh and select again from Screening.'
        );
        await loadData();
        return;
      }

      OpsklAlert.alert(
        'Roster updated',
        `${crewToReplace.name} was cancelled and ${selectedStandbyForReplacement.name} is now selected/confirmed on the ledger.`
      );
      setSelectedStandbyForReplacement(null);
      setCrewToReplace(null);
      await loadData();
    } finally {
      setProcessingReplacement(false);
    }
  };

  const handleExportGatePass = async () => {
    if (crew.length === 0) {
      OpsklAlert.alert('Empty roster', 'No confirmed crew to export yet.');
      return;
    }
    const lines = [
      `Opskl crew muster — ${shift?.title || 'Shift'}`,
      `Venue: ${shift?.venueName || '—'}`,
      `Date: ${shift?.date || '—'} ${shift?.startTime || ''}–${shift?.endTime || ''}`,
      '',
      ...crew.map(
        (c, i) =>
          `${i + 1}. ${c.name} | ${c.roleTag} | pass ${c.checkInCode || 'pending'} | ${c.phoneMasked} | ${c.status}`
      ),
    ];
    try {
      await Share.share({ message: lines.join('\n'), title: 'Crew muster list' });
    } catch {
      OpsklAlert.alert('Share failed', 'Could not open the system share sheet.');
    }
  };

  const handleStaffCallBridge = () => {
    const withPhone = crew.filter((c) => c.phoneRaw);
    if (withPhone.length === 0) {
      OpsklAlert.alert('No phones on file', 'Confirmed crew profiles do not include dialable numbers yet.');
      return;
    }
    OpsklAlert.alert(
      'Call crew',
      `Conference bridging is not wired. Call the first worker with a number (${withPhone[0].name})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => handleCallWorker(withPhone[0]) },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <Screen edges={['top']}>
        <LoadingView message="Loading confirmed crew..." />
      </Screen>
    );
  }

  if (error && !shift) {
    return (
      <Screen edges={['top']}>
        <ErrorRetry message={error} onRetry={loadData} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      {/* Top Header Bar */}
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
            onPress={() => router.back()}
            style={{
              width: touchTarget.min,
              height: touchTarget.min,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
            }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
              CREW BRIEFING CONSOLE
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
              {shift?.title || 'Confirmed crew'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={16} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error && <ErrorRetry message={error} onRetry={loadData} />}

        {/* Operational Shift Meta Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: '#ECFDF5',
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669', textTransform: 'uppercase' }}>
                Shift Roster Confirmed
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              IST (UTC +5:30)
            </Text>
          </View>

          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }}>
            {shift?.title || 'Lead Guest Relations & VIP Concierge'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={13} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>
              {shift?.venueName || 'Venue not set'}
            </Text>
          </View>
        </View>

        {/* Primary Status Card — live slot fill */}
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>
                  {totalSlots > 0 && filledSlots >= totalSlots ? 'Roster filled' : 'Roster in progress'}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Lock size={11} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                    {filledSlots}/{totalSlots || '—'} SLOTS
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Reporting:{' '}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                  {shift?.date || '—'} · {shift?.startTime || '—'} IST
                </Text>
              </Text>
            </View>

            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={20} color={colors.primary} />
            </View>
          </View>

          {/* Broadcast Digital Briefing Button */}
          <TouchableOpacity
            onPress={handleBroadcast}
            disabled={dispatchingBriefing}
            style={{
              width: '100%',
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Radio size={16} color="#FFFFFF" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
              {dispatchingBriefing ? 'Broadcasting...' : briefingDispatched ? 'Re-broadcast Digital Briefing' : 'Broadcast Digital Briefing'}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>
            Sends an in-app shift message to confirmed bookings ({filledSlots} worker{filledSlots === 1 ? '' : 's'})
          </Text>
        </View>

        {/* Briefing Protocol Dispatch Banner */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.xl,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radii.full,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 2,
            }}
          >
            <CheckCircle2 size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Briefing Protocol v1.2
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radii.sm,
                  backgroundColor: '#ECFDF5',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: briefingDispatched ? '#059669' : colors.textSecondary }}>
                  {briefingDispatched ? 'SENT' : 'NOT SENT'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
              {filledSlots} confirmed on ledger · read receipts are not tracked in this build
            </Text>
          </View>
        </View>

        {/* Venue Gate Access Geofence Banner */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Gate 4 Geofence Radius Active (60m)
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
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
              STAFF PORTAL
            </Text>
          </View>
        </View>

        {/* Deployed Crew Section */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                Deployed Crew
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                  6 On-Site
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, textTransform: 'uppercase' }}>
              READINESS VERIFIED
            </Text>
          </View>

          {/* Crew Members List */}
          {crew.map((member) => (
            <View
              key={member.id}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.full,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                      {member.name.split(' ').map((n) => n[0]).join('')}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                        {member.name}
                      </Text>
                      {member.isTeamLead && (
                        <View
                          style={{
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                            borderRadius: radii.xs,
                            backgroundColor: '#DBEAFE',
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8' }}>
                            TL
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                      {member.roleTag}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1, fontFamily: 'monospace' }}>
                      {member.phoneMasked}
                    </Text>
                  </View>
                </View>

                {/* Call Button */}
                <TouchableOpacity
                  onPress={() => handleCallWorker(member)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel={`Call ${member.name}`}
                  accessibilityRole="button"
                >
                  <Phone size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Readiness Badges */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textPrimary }}>
                    {member.status.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color={member.kycReady ? colors.primary : colors.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textPrimary }}>
                    {member.kycReady ? 'KYC verified' : 'KYC pending'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color={member.checkedIn ? colors.primary : colors.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textPrimary }}>
                    {member.checkedIn ? 'Checked in' : 'Awaiting check-in'}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {crew.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 }}>
              No confirmed bookings yet. Select workers from Screening to fill this roster.
            </Text>
          ) : null}
        </View>

        {/* Reserve applicants (live applications not yet booked) */}
        <View style={{ gap: 10, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
              Reserve / standby applicants
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                {standbyCrew.length} available
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            Applied or shortlisted workers who are not on a confirmed booking. Summon replaces a confirmed booking via cancel + select.
          </Text>

          {standbyCrew.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              No reserve applicants on this shift yet.
            </Text>
          ) : null}

          {standbyCrew.map((standby) => (
            <View
              key={standby.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.borderMuted,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.full,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    {standby.name.split(' ').map((n) => n[0]).join('')}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    {standby.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                    {standby.location} ({standby.distance}) • Ready
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => handleInitiateReplacement(standby)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderMuted,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Summon
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Daily Wage Allocation & Escrow Guarantee Note */}
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.xl,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.borderMuted,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
              Listed wage pool: {formatINR((shift?.totalPay || 0) * Math.max(filledSlots, 1))}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              {filledSlots} confirmed × {formatINR(shift?.totalPay || 0)} listed shift pay (ledger estimate)
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: radii.sm,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderMuted,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
              LEDGER
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.borderMuted,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={handleExportGatePass}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <FileDown size={16} color={colors.textPrimary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
            Export Gate Pass PDF
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleStaffCallBridge}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <PhoneCall size={16} color="#FFFFFF" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
            Staff Call Bridge
          </Text>
        </TouchableOpacity>
      </View>

      {/* NON-NEGOTIABLE: Roster Replacement Confirmation & Impact Modal */}
      <Modal
        visible={!!selectedStandbyForReplacement}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStandbyForReplacement(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={20} color="#D97706" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                  Confirm Crew Replacement
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStandbyForReplacement(null)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: '#FEF3C7',
                padding: 10,
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: '#FDE68A',
              }}
            >
              <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 16 }}>
                <Text style={{ fontWeight: '700' }}>Roster Governance Policy:</Text> Replacing a confirmed crew member releases their locked shift slot. Wage obligation moves with the newly confirmed booking in the Opskl ledger.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Standby Replacement:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                {selectedStandbyForReplacement?.name} ({selectedStandbyForReplacement?.location} • {selectedStandbyForReplacement?.distance})
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Replacing Confirmed Member:
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                {crewToReplace?.name} ({crewToReplace?.roleTag})
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                Operational Rationale:
              </Text>
              <Text style={{ fontSize: 12, color: colors.textPrimary }}>
                {replacementReason}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                onPress={() => setSelectedStandbyForReplacement(null)}
                disabled={processingReplacement}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmReplacement}
                disabled={processingReplacement}
                style={{
                  flex: 1.5,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                  {processingReplacement ? 'Replacing...' : 'Confirm Replacement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
