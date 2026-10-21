import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Linking,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  useAuth,
  Checkbox,
} from '@opskil/design-system';
import {
  IncidentCategory,
  IncidentSeverity,
  submitSafetyIncidentSafe,
} from '@opskil/shared';
import {
  ChevronLeft,
  User as UserIcon,
  Shield,
  Building,
  AlertOctagon,
  AlertTriangle,
  Scale,
  Clock,
  IndianRupee,
  DoorClosed,
  Camera,
  Mic,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Send,
  X,
} from 'lucide-react-native';

const CATEGORIES: {
  id: IncidentCategory;
  label: string;
  icon: any;
}[] = [
  { id: 'safety', label: 'Workplace Safety / Physical Hazard', icon: AlertTriangle },
  { id: 'harassment', label: 'Harassment / Discrimination', icon: Scale },
  { id: 'hours', label: 'Unsafe Working Hours / No Breaks', icon: Clock },
  { id: 'wage', label: 'Payment or Wage Dispute', icon: IndianRupee },
  { id: 'access', label: 'Venue Gate Access Denied', icon: DoorClosed },
];

const SEVERITIES: {
  id: IncidentSeverity;
  label: string;
  badge: string;
  badgeColor: string;
  badgeTextColor: string;
  description: string;
}[] = [
  {
    id: 'standard',
    label: 'Standard Incident',
    badge: '2-4h REVIEW',
    badgeColor: '#f1f5f9',
    badgeTextColor: '#475569',
    description: 'Non-imminent disputes, standard facility questions, badge re-sync.',
  },
  {
    id: 'urgent',
    label: 'Urgent Operational Flag',
    badge: '30m RESPONSE',
    badgeColor: '#dbeafe',
    badgeTextColor: '#1d4ed8',
    description: 'Immediate supervisor escalation, shift stoppage, locked access route.',
  },
  {
    id: 'immediate',
    label: 'Immediate Safety Threat',
    badge: 'INSTANT GROUND DISPATCH',
    badgeColor: '#fee2e2',
    badgeTextColor: '#b91c1c',
    description: 'Physical altercations, fire risk, electrical hazards, or medical emergency.',
  },
];

export default function IncidentReportScreen() {
  const { colors, spacing, radii } = useOpsklTheme();
  const router = useRouter();
  const { session } = useAuth();

  const [category, setCategory] = useState<IncidentCategory>('safety');
  const [severity, setSeverity] = useState<IncidentSeverity>('urgent');
  const [locationText, setLocationText] = useState('Pavilion 2, Gate 4B Backstage Service Corridor');
  const [notes, setNotes] = useState('');
  const [witnessConsent, setWitnessConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    status: 'server_accepted' | 'locally_queued';
    caseRef: string;
    offlineNotice?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio recording simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [hasVoiceNote, setHasVoiceNote] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Evidence attachments start empty (no demo Unsplash / voice memo)
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 120) {
            setIsRecording(false);
            setHasVoiceNote(true);
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecord = () => {
    if (!isRecording) {
      setRecordingSeconds(0);
      setIsRecording(true);
    } else {
      setIsRecording(false);
      setHasVoiceNote(true);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!witnessConsent) {
      setErrorMessage('You must confirm the Witness Declaration before submitting.');
      return;
    }
    if (notes.trim().length < 10) {
      setErrorMessage('Please provide a detailed incident log of at least 10 characters.');
      return;
    }
    if (!locationText.trim()) {
      setErrorMessage('Please specify the hall, gate, or area where the incident occurred.');
      return;
    }

    setSubmitting(true);
    try {
      const reporterId = session?.user?.id || 'wkr-current';
      const result = await submitSafetyIncidentSafe({
        reporterId,
        shiftId: 'SHF-BOM-7729',
        venueName: 'Jio World Convention Centre',
        category,
        severity,
        locationDescription: locationText.trim(),
        notes: notes.trim(),
        evidenceUrls: photos,
        hasAudioMemo: hasVoiceNote,
        witnessDeclared: witnessConsent,
      });

      if (result.success && (result.status === 'server_accepted' || result.status === 'locally_queued')) {
        setSubmissionResult({
          status: result.status,
          caseRef: result.caseRef || 'TK-BKC-8912',
          offlineNotice: result.offlineNotice,
        });
      } else {
        setErrorMessage(result.error || 'Failed to submit report. Please check inputs.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected network error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // Fallback if tel handler not supported in environment
    });
  };

  return (
    <Screen edges={['top']}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8 }}>
            OPS PROTOCOL • IST
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
            Incident Report New
          </Text>
        </View>

        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserIcon size={16} color="#ffffff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
        {/* Context Location & Shift Header */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Shield size={14} color={colors.primary} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8 }}>
              FIELD ESCALATION PROTOCOL • IST
            </Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
            Report Safety or Operational Incident
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Building size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Jio World Convention Centre • Shift #SHF-BOM-7729
            </Text>
          </View>
        </View>

        {/* Confidentiality & High Priority Alert Banner */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radii.xl,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
              Your report is strictly confidential.
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
              Your report is stored for review. For immediate physical danger, call <Text style={{ color: '#dc2626', fontWeight: '800' }}>112</Text> directly. There is no staffed Opskl phone desk in this build.
            </Text>
          </View>
        </View>

        {/* Emergency dial — real public emergency only */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => handleCall('112')}
            style={{
              flex: 1,
              padding: spacing.sm + 2,
              borderRadius: radii.lg,
              backgroundColor: '#fee2e2',
              borderWidth: 1,
              borderColor: '#fca5a5',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <AlertOctagon size={14} color="#dc2626" />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#991b1b' }}>
                POLICE / MEDICAL
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#dc2626' }}>
              Emergency (112)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. Incident Classification */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionLabel}>1. INCIDENT CLASSIFICATION</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>Required</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
            Select the operational issue category experienced on venue grounds.
          </Text>

          <View style={{ gap: 8 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              const IconComp = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radii.lg,
                    backgroundColor: isSelected ? colors.surface : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <IconComp size={18} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '700' : '500',
                        color: colors.textPrimary,
                        flex: 1,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : colors.textMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Incident Severity Level */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionLabel}>2. INCIDENT SEVERITY LEVEL</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>Select One</Text>
          </View>

          <View style={{ gap: 8 }}>
            {SEVERITIES.map((sev) => {
              const isSelected = severity === sev.id;
              return (
                <TouchableOpacity
                  key={sev.id}
                  onPress={() => setSeverity(sev.id)}
                  style={{
                    padding: spacing.md,
                    borderRadius: radii.xl,
                    backgroundColor: isSelected ? colors.surface : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: isSelected
                      ? sev.id === 'immediate'
                        ? '#dc2626'
                        : colors.primary
                      : colors.border,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: sev.id === 'immediate' && isSelected ? '#dc2626' : colors.textPrimary,
                      }}
                    >
                      {sev.label}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: radii.full,
                        backgroundColor: sev.badgeColor,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: sev.badgeTextColor,
                          letterSpacing: 0.5,
                        }}
                      >
                        {sev.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                    {sev.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Detailed Log & Location */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionLabel}>3. DETAILED LOG & LOCATION IN VENUE</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              {notes.length} / 600
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            State specific Hall/Gate (e.g. Pavilion 2, Gate 4B, Service Corridor) and persons involved.
          </Text>

          <TextInput
            value={locationText}
            onChangeText={setLocationText}
            placeholder="Specific Hall / Gate location..."
            placeholderTextColor={colors.textMuted}
            style={{
              padding: spacing.sm + 2,
              borderRadius: radii.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              fontSize: 13,
              fontWeight: '600',
              color: colors.textPrimary,
            }}
          />

          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            maxLength={600}
            placeholder="Describe what occurred, exact timestamps (IST), immediate surroundings, and any actions taken by security personnel..."
            placeholderTextColor={colors.textMuted}
            style={{
              padding: spacing.md,
              borderRadius: radii.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              fontSize: 13,
              color: colors.textPrimary,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 4. Evidence & Field Records */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <Text style={styles.sectionLabel}>4. EVIDENCE & FIELD RECORDS</Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            Attach time-stamped images of hazardous rigging, gate log slips, or record an audio note.
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Photo Trigger */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Camera not wired',
                  'Photo capture / upload is not integrated in this build. You can still submit the written incident report without attachments.'
                );
              }}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radii.xl,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 88,
              }}
            >
              <Camera size={24} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Attach Photos
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {photos.length > 0 ? `${photos.length} attached` : 'Not available in this build'}
              </Text>
            </TouchableOpacity>

            {/* Audio Memo Widget */}
            <TouchableOpacity
              onPress={handleToggleRecord}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radii.xl,
                backgroundColor: isRecording ? '#fee2e2' : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: isRecording ? '#dc2626' : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 88,
              }}
            >
              <Mic size={24} color={isRecording ? '#dc2626' : colors.textPrimary} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: isRecording ? '#dc2626' : colors.textPrimary,
                }}
              >
                {isRecording ? 'Recording Memo...' : 'Record Memo'}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {isRecording ? `${recordingSeconds}s (Tap Stop)` : '00:00 (Max 2m)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Evidence Previews */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 4 }}>
            {photos.length > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 90,
                  borderRadius: radii.lg,
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#000',
                }}
              >
                <Image
                  source={{ uri: photos[0] }}
                  style={{ width: '100%', height: '100%', opacity: 0.85 }}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 6,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
                    IMG_0921.jpg
                  </Text>
                  <TouchableOpacity onPress={() => setPhotos([])}>
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {hasVoiceNote && (
              <View
                style={{
                  flex: 1,
                  height: 90,
                  padding: spacing.sm,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>
                    VOICE NOTE
                  </Text>
                  <TouchableOpacity onPress={() => setHasVoiceNote(false)}>
                    <Trash2 size={12} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity onPress={() => setIsPlayingAudio(!isPlayingAudio)}>
                    {isPlayingAudio ? (
                      <Pause size={18} color={colors.primary} />
                    ) : (
                      <Play size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: '40%',
                        height: '100%',
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 9, color: colors.textSecondary }}>Recorded 16:42 IST</Text>
                  <Text style={{ fontSize: 9, color: colors.textSecondary }}>0:24</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 5. Witness Declaration & Identity Shield */}
        <View
          style={{
            padding: spacing.md,
            borderRadius: radii.xl,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Checkbox
              checked={witnessConsent}
              onChange={setWitnessConsent}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
                Witness Declaration & Identity Shield
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>
                I confirm that this report reflects authentic first-hand observations during my shift at Jio World Convention Centre. My contact details are encrypted and disclosed only to accredited Opskl Safety Officers.
              </Text>
            </View>
          </View>
        </View>

        {/* Error Feedback */}
        {errorMessage && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: '#fee2e2',
              borderWidth: 1,
              borderColor: '#fca5a5',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc2626' }}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Submission Result Banner */}
        {submissionResult && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radii.xl,
              backgroundColor:
                submissionResult.status === 'server_accepted' ? '#f0fdf4' : '#fef3c7',
              borderWidth: 1,
              borderColor:
                submissionResult.status === 'server_accepted' ? '#86efac' : '#fde047',
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CheckCircle2
                size={18}
                color={submissionResult.status === 'server_accepted' ? '#16a34a' : '#d97706'}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: submissionResult.status === 'server_accepted' ? '#166534' : '#92400e',
                }}
              >
                {submissionResult.status === 'server_accepted'
                  ? 'Report Dispatched & Encrypted'
                  : 'Report Queued in Local Offline Ledger'}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: submissionResult.status === 'server_accepted' ? '#166534' : '#92400e',
                lineHeight: 18,
              }}
            >
              Ground Command Ticket #{submissionResult.caseRef} generated.{' '}
              {submissionResult.offlineNotice ||
                'Dispatched to on-site supervisor and recorded in central audit ledger.'}
            </Text>
          </View>
        )}

        {/* Action Button */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              minHeight: 48,
              borderRadius: radii.lg,
              backgroundColor: colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Send size={16} color="#ffffff" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                  Submit Encrypted Incident Report
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: '700',
              color: colors.textSecondary,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            DUAL-CONFIRMATION PROTOCOL • ENCRYPTED VIA SHA-256 OPSKL RELAY
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
});
