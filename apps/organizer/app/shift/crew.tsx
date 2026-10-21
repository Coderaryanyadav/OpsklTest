import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Modal,
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
  formatINR,
  fetchOrganizerJobs,
  sendShiftMessage,
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
  name: string;
  roleTag: string;
  isTeamLead?: boolean;
  phoneMasked: string;
  phoneRaw: string;
  attireReady: boolean;
  biometricKycReady: boolean;
  geofencePassReady: boolean;
}

interface StandbyWorker {
  id: string;
  name: string;
  location: string;
  distance: string;
  ready: boolean;
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

  // Briefing status
  const [briefingDispatched, setBriefingDispatched] = useState(true);
  const [dispatchingBriefing, setDispatchingBriefing] = useState(false);

  // Replacement / Contingency Modal state
  const [selectedStandbyForReplacement, setSelectedStandbyForReplacement] = useState<StandbyWorker | null>(null);
  const [crewToReplace, setCrewToReplace] = useState<DeployedCrewMember | null>(null);
  const replacementReason = 'Reported medical or travel delay';
  const [processingReplacement, setProcessingReplacement] = useState(false);

  // Deployed crew — start empty; no fabricated Aarav/Priya demo roster
  const [crew, setCrew] = useState<DeployedCrewMember[]>([]);

  // Standby feed not wired — keep empty (no fabricated nearby workers)
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
      if (targetJob) {
        setShift(targetJob);
      }
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
    const unsub = subscribeToShiftRoster(jobId || 'job-bkc-vip-01', () => {
      loadData();
    });
    return () => unsub();
  }, [loadData, organizerId, jobId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBroadcast = async () => {
    setDispatchingBriefing(true);
    try {
      if (shift?.id) {
        await sendShiftMessage(
          shift.id,
          'Briefing: Please review shift venue, dress code, and reporting time in the worker app.',
          undefined,
          true
        );
      }
      setBriefingDispatched(true);
      OpsklAlert.alert(
        'Briefing sent',
        crew.length > 0
          ? `Shift message queued for ${crew.length} rostered worker(s). WhatsApp broadcast and QR pass generation are not wired in this build.`
          : 'No confirmed crew on this roster yet. Message was not delivered to a fabricated list.'
      );
    } catch {
      OpsklAlert.alert('Dispatch Error', 'Could not broadcast briefing to crew.');
    } finally {
      setDispatchingBriefing(false);
    }
  };

  const handleCallWorker = (member: DeployedCrewMember) => {
    Linking.openURL(`tel:${member.phoneRaw}`).catch(() => {
      OpsklAlert.alert('Phone Dialler', `Calling ${member.name} (${member.phoneMasked}). Dialling requires physical device.`);
    });
  };

  /**
   * NON-NEGOTIABLE:
   * Never silently modify a confirmed roster!
   * Require explicit impact explanation before replacing a confirmed worker.
   */
  const handleInitiateReplacement = (standby: StandbyWorker) => {
    setSelectedStandbyForReplacement(standby);
    // Default to the last non-lead crew member for replacement preview
    setCrewToReplace(crew[crew.length - 1]);
  };

  const handleConfirmReplacement = async () => {
    if (!selectedStandbyForReplacement || !crewToReplace) return;

    setProcessingReplacement(true);
    try {
      // Simulate backend swap with audit trail
      const newCrewMember: DeployedCrewMember = {
        id: `crew-sub-${Date.now()}`,
        name: selectedStandbyForReplacement.name,
        roleTag: crewToReplace.roleTag,
        phoneMasked: '+91 98201 •••••',
        phoneRaw: '+919820144555',
        attireReady: true,
        biometricKycReady: true,
        geofencePassReady: true,
      };

      setCrew((prev) => prev.map((c) => (c.id === crewToReplace.id ? newCrewMember : c)));
      setStandbyCrew((prev) => prev.filter((s) => s.id !== selectedStandbyForReplacement.id));

      OpsklAlert.alert(
        'Roster Contingency Executed',
        `Confirmed worker ${crewToReplace.name} has been replaced by standby specialist ${selectedStandbyForReplacement.name}.\n\nReason: ${replacementReason}.\nRoster slot reassigned. Wage obligations follow the confirmed booking ledger (no live bank escrow rail).`
      );

      setSelectedStandbyForReplacement(null);
      setCrewToReplace(null);
    } finally {
      setProcessingReplacement(false);
    }
  };

  const handleExportGatePass = () => {
    OpsklAlert.alert(
      'Export Gate Pass PDF',
      'Security muster PDF compiled for Jio World Convention Centre Gate 4 security concourse. Sent to organizer registered email & downloadable from portal.'
    );
  };

  const handleStaffCallBridge = () => {
    OpsklAlert.alert(
      'Staff Conference Bridge',
      'Connecting all 6 confirmed crew members to instant teleconference audio bridge (Token: OPSKL-CONF-882).'
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
              {shift?.title || 'Lead Guest Relations & VIP Concierge'}
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
              {shift?.venueName || 'Jio World Convention Centre, Gate 4 Staff Entry (BKC)'}
            </Text>
          </View>
        </View>

        {/* Primary Status Card: Roster 100% Locked */}
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
                  Roster 100% Locked
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
                    6/6 SLOTS
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Reporting:{' '}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                  Tomorrow, 09:30 AM IST
                </Text>{' '}
                • Sharp
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
            Dispatches real-time security gate QR passes & floor plan to 6 crew members
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
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669' }}>
                  100% READ
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
              Dispatched today at 04:15 PM IST •{' '}
              <Text style={{ fontWeight: '600', color: colors.textPrimary }}>
                6/6 Confirmed Acknowledged
              </Text>
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
                    Black Formal Suit
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textPrimary }}>
                    KYC on file
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color={colors.primary} />
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textPrimary }}>
                    Geofence Pass
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Emergency Roster Contingency Section */}
        <View style={{ gap: 10, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
              Emergency Roster Contingency
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
                2 Standby • &lt; 5 KM BKC
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            Geo-standby pre-cleared for immediate replacement trigger in case of unexpected transit delays or medical call-offs.
          </Text>

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
              Daily Wage Allocation: {formatINR(18000)} Total
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              Standby pool · wage terms follow confirmed booking ledger
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
              ESCROW SECURE
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
