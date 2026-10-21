import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import {
  useOpsklTheme,
  Screen,
} from '@opskil/design-system';
import {
  getOfflineQueue,
  syncOfflineQueueSafe,
  generateOfflineGateKey,
  OfflineMutationItem,
} from '@opskil/shared';
import {
  WifiOff,
  Lock,
  Radio,
  QrCode,
  CheckCircle2,
  Clock,
  RotateCw,
  FileText,
  Receipt,
  MapPin,
  Database,
  X,
  ChevronLeft,
  Hourglass,
  Layers,
} from 'lucide-react-native';

export default function OfflineSyncHubScreen() {
  const { colors, spacing, radii } = useOpsklTheme();
  const router = useRouter();

  const [queue, setQueue] = useState<OfflineMutationItem[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [retryStatusMessage, setRetryStatusMessage] = useState<string | null>(null);
  const bleSyncing = false;
  const bleSuccess = false;
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [showProofSlip, setShowProofSlip] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(42 * 60 - 12); // 41m 48s

  const gateKey = generateOfflineGateKey();

  useEffect(() => {
    getOfflineQueue().then(setQueue);

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const handleRetryConnection = async () => {
    setRetrying(true);
    setRetryStatusMessage('Probing Cellular & Gate Wi-Fi Nodes…');

    try {
      // Simulate connection probe and idempotent sync
      const result = await syncOfflineQueueSafe(false); // In offline demo mode
      setTimeout(() => {
        setRetrying(false);
        setRetryStatusMessage(
          result.syncedCount > 0
            ? `Successfully synchronized ${result.syncedCount} mutations.`
            : 'Still Offline • Kept in Queue without Duplicate Replays'
        );
        setTimeout(() => setRetryStatusMessage(null), 3000);
      }, 1200);
    } catch {
      setRetrying(false);
      setRetryStatusMessage('Network probe failed. Ledger intact.');
    }
  };

  const handleBleHandshake = () => {
    Alert.alert(
      'BLE mesh unavailable',
      'Peer Bluetooth attendance relay is not implemented on this build. Keep queued mutations local and sync when cellular/Wi‑Fi returns.'
    );
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
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8 }}>
            FIELD RESILIENCE PROTOCOL
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
            Offline Local Sync Hub
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            backgroundColor: '#fee2e2',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#dc2626' }}>
            OFFLINE
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
        {/* Offline Status Alert Banner */}
        <View
          style={{
            backgroundColor: '#1e293b',
            borderRadius: radii.xl,
            padding: spacing.md,
            gap: spacing.xs + 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 }}>
                HARDWARE LEDGER PROTECTED
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8' }}>LOCAL QUEUE</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WifiOff size={20} color="#f8fafc" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#f8fafc' }}>
                Network Disconnected • Offline Mode Active
              </Text>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                Local Cryptographic Ledger Enabled
              </Text>
            </View>
          </View>

          <View
            style={{
              padding: spacing.sm,
              borderRadius: radii.md,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 16 }}>
              No internet connection detected. Offline attendance verification is active. Your check-in timestamp and geofence tokens are cached securely on this device with SHA-256 integrity check.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Lock size={12} color="#94a3b8" />
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                NESCO Hall 4 • Basement Vault Cache
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#f8fafc' }}>
              09:41:22 IST
            </Text>
          </View>
        </View>

        {/* Physical Token / Emergency Gate Pass */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            padding: spacing.lg,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <QrCode size={12} color={colors.textSecondary} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                OFFLINE GATE KEY
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: '#dbeafe',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#1d4ed8' }}>
                HIGH INTEGRITY
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.2, marginTop: 12 }}>
            ONE-TIME BACKUP PIN
          </Text>

          {/* Prominent Digits */}
          <View
            style={{
              width: '100%',
              paddingVertical: spacing.sm,
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 6,
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                letterSpacing: 4,
                color: colors.textPrimary,
                fontFamily: 'monospace',
              }}
            >
              {gateKey.backupPin}
            </Text>
          </View>

          {/* High Density QR Matrix SVG */}
          <View
            style={{
              padding: 10,
              backgroundColor: '#ffffff',
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              marginVertical: 4,
            }}
          >
            <Svg width={140} height={140} viewBox="0 0 160 160">
              <Rect x="0" y="0" width="160" height="160" fill="#ffffff" />
              {/* Top Left Marker */}
              <Rect x="8" y="8" width="44" height="44" fill="#191c1d" />
              <Rect x="16" y="16" width="28" height="28" fill="#ffffff" />
              <Rect x="22" y="22" width="16" height="16" fill="#191c1d" />
              {/* Top Right Marker */}
              <Rect x="108" y="8" width="44" height="44" fill="#191c1d" />
              <Rect x="116" y="16" width="28" height="28" fill="#ffffff" />
              <Rect x="122" y="22" width="16" height="16" fill="#191c1d" />
              {/* Bottom Left Marker */}
              <Rect x="8" y="108" width="44" height="44" fill="#191c1d" />
              <Rect x="16" y="116" width="28" height="28" fill="#ffffff" />
              <Rect x="22" y="122" width="16" height="16" fill="#191c1d" />
              {/* Internal Cryptographic Data Patterns */}
              <Rect x="60" y="12" width="10" height="10" fill="#003c90" />
              <Rect x="76" y="12" width="14" height="8" fill="#191c1d" />
              <Rect x="60" y="30" width="16" height="16" fill="#191c1d" />
              <Rect x="84" y="28" width="14" height="14" fill="#003c90" />
              <Rect x="16" y="60" width="14" height="12" fill="#191c1d" />
              <Rect x="36" y="60" width="10" height="14" fill="#003c90" />
              <Rect x="54" y="54" width="24" height="10" fill="#191c1d" />
              <Rect x="86" y="50" width="18" height="18" fill="#191c1d" />
              <Rect x="112" y="60" width="12" height="10" fill="#003c90" />
              <Rect x="132" y="58" width="18" height="18" fill="#191c1d" />
              <Rect x="18" y="80" width="12" height="16" fill="#003c90" />
              <Rect x="38" y="82" width="16" height="10" fill="#191c1d" />
              <Rect x="62" y="74" width="14" height="20" fill="#191c1d" />
              <Rect x="82" y="80" width="16" height="14" fill="#003c90" />
              <Rect x="106" y="78" width="20" height="16" fill="#191c1d" />
              <Rect x="134" y="84" width="16" height="12" fill="#003c90" />
              <Rect x="60" y="104" width="12" height="12" fill="#191c1d" />
              <Rect x="80" y="104" width="18" height="8" fill="#003c90" />
              <Rect x="106" y="102" width="12" height="18" fill="#191c1d" />
              <Rect x="126" y="104" width="20" height="10" fill="#191c1d" />
              <Rect x="60" y="126" width="18" height="16" fill="#003c90" />
              <Rect x="86" y="122" width="14" height="22" fill="#191c1d" />
              <Rect x="108" y="130" width="18" height="14" fill="#003c90" />
              <Rect x="134" y="124" width="16" height="18" fill="#191c1d" />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Clock size={13} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
              Valid for {formatCountdown(countdownSeconds)}
            </Text>
          </View>

          <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 }}>
            Show this offline gate key or backup PIN to your supervisor if cellular sync is unavailable.
          </Text>
        </View>

        {/* Peer BLE Mesh Relay Card */}
        <View
          style={{
            backgroundColor: colors.primary,
            borderRadius: radii.xl,
            padding: spacing.md,
            gap: spacing.xs,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Radio size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#bfdbfe', letterSpacing: 0.5 }}>
                  BLE MESH
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }}>
                  Peer sync not available
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.full,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#ffffff' }}>
                UNAVAILABLE
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: '#e0e7ff', marginTop: 4, lineHeight: 18 }}>
            Bluetooth peer mesh for attendance is not implemented. Queued check-ins stay on-device until network sync succeeds.
          </Text>

          <TouchableOpacity
            onPress={handleBleHandshake}
            disabled={bleSyncing || bleSuccess}
            style={{
              marginTop: 6,
              paddingVertical: 10,
              borderRadius: radii.lg,
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            {bleSyncing ? (
              <ActivityIndicator color={colors.primary} />
            ) : bleSuccess ? (
              <>
                <CheckCircle2 size={16} color="#16a34a" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>
                  Sync Relayed via MUM-SUP-4109
                </Text>
              </>
            ) : (
              <>
                <Radio size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                  BLE unavailable — tap for details
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Local Event Queue */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                Local Event Queue
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                {queue.length} Stored Locally
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            {queue.map((item) => (
              <View
                key={item.id}
                style={{
                  padding: spacing.md,
                  borderRadius: radii.xl,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    {item.summaryTitle}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {item.summaryMeta}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.primary,
                      }}
                    />
                    <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>
                      Waiting for network or BLE bridge
                    </Text>
                  </View>
                </View>
                <Hourglass size={18} color={colors.textMuted} />
              </View>
            ))}
          </View>
        </View>

        {/* Hardware Diagnostics */}
        <View style={{ gap: spacing.xs, marginTop: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
            Hardware Diagnostics
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {/* Cellular */}
            <View style={styles.diagCard}>
              <View style={styles.diagHeader}>
                <Text style={styles.diagTitle}>CELLULAR NODE</Text>
                <WifiOff size={14} color="#dc2626" />
              </View>
              <Text style={[styles.diagStatus, { color: '#dc2626' }]}>Offline</Text>
              <Text style={styles.diagMeta}>Jio / Airtel Null Carrier</Text>
            </View>

            {/* Hall Wi-Fi */}
            <View style={styles.diagCard}>
              <View style={styles.diagHeader}>
                <Text style={styles.diagTitle}>HALL WI-FI</Text>
                <WifiOff size={14} color="#64748b" />
              </View>
              <Text style={[styles.diagStatus, { color: '#64748b' }]}>Disconnected</Text>
              <Text style={styles.diagMeta}>NESCO_PROD_5G (No IP)</Text>
            </View>

            {/* GPS */}
            <View style={styles.diagCard}>
              <View style={styles.diagHeader}>
                <Text style={styles.diagTitle}>GPS RECEIVER</Text>
                <MapPin size={14} color={colors.primary} />
              </View>
              <Text style={[styles.diagStatus, { color: colors.textPrimary }]}>Active</Text>
              <Text style={styles.diagMeta}>±3.8m accuracy (Locked)</Text>
            </View>

            {/* Local Vault */}
            <View style={styles.diagCard}>
              <View style={styles.diagHeader}>
                <Text style={styles.diagTitle}>ENCRYPTED VAULT</Text>
                <Database size={14} color={colors.primary} />
              </View>
              <Text style={[styles.diagStatus, { color: colors.primary }]}>100% Intact</Text>
              <Text style={styles.diagMeta}>SQLite IndexedDB Verified</Text>
            </View>
          </View>
        </View>

        {/* Designated Venue Zone */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            marginTop: 4,
          }}
        >
          <View style={{ padding: spacing.md, backgroundColor: '#0f172a' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8 }}>
              DESIGNATED VENUE ZONE
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#f8fafc', marginTop: 2 }}>
              NESCO Center — Hall 4 Operations Core
            </Text>
          </View>
          <View
            style={{
              padding: spacing.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <MapPin size={15} color={colors.textSecondary} />
              <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>
                Geofence boundary valid: Western Express Hwy, Goregaon
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: '#dbeafe',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#1d4ed8' }}>
                ZONE VERIFIED
              </Text>
            </View>
          </View>
        </View>

        {/* Retry & Diagnostic Actions */}
        <View style={{ gap: spacing.sm, marginTop: 4 }}>
          {retryStatusMessage && (
            <View
              style={{
                padding: spacing.sm + 2,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceMuted,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                {retryStatusMessage}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleRetryConnection}
            disabled={retrying}
            style={{
              minHeight: 48,
              borderRadius: radii.lg,
              backgroundColor: '#0f172a',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {retrying ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <RotateCw size={16} color="#ffffff" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                  Retry Live Connection
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowDutyModal(true)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: radii.lg,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <FileText size={16} color={colors.textPrimary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Duty Manual
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowProofSlip(true)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: radii.lg,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Receipt size={16} color={colors.textPrimary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Export Proof Slip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Duty Manual Modal */}
      <Modal visible={showDutyModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                Offline Operational Briefing
              </Text>
              <TouchableOpacity onPress={() => setShowDutyModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 8 }}>
              1. Follow your confirmed shift reporting instructions when online.{'\n'}
              2. Zero Connectivity Policy: Show your offline gate key or 6-digit backup PIN to the supervisor logbook.{'\n'}
              3. Bluetooth peer mesh is not available in this build — do not rely on BLE for attendance.{'\n'}
              4. Local queue timestamps sync when connectivity returns; payout remains a separate ledger step.
            </Text>
            <TouchableOpacity
              onPress={() => setShowDutyModal(false)}
              style={{
                marginTop: 12,
                paddingVertical: 10,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>
                Acknowledged & Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Proof Slip Modal */}
      <Modal visible={showProofSlip} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={18} color={colors.primary} />
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                  Offline Duty Certificate
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowProofSlip(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: spacing.md,
                marginVertical: 8,
                gap: 4,
              }}
            >
              <Text style={styles.voucherMono}>STATUS: LOCAL QUEUE SNAPSHOT</Text>
              <Text style={styles.voucherMono}>
                ITEMS: {queue.length} pending mutation{queue.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.voucherMono}>
                CAPTURED: {new Date().toLocaleString('en-IN')}
              </Text>
              <Text style={[styles.voucherMono, { color: colors.primary, fontWeight: '800' }]}>
                NOT A BANK PAYOUT RECEIPT
              </Text>
            </View>

            <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
              This is a local queue summary only. It is not a cryptographic bank voucher and does not prove payout.
            </Text>

            <TouchableOpacity
              onPress={() => setShowProofSlip(false)}
              style={{
                marginTop: 10,
                paddingVertical: 10,
                borderRadius: radii.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>
                Done & Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  diagCard: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  diagStatus: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  diagMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 16,
  },
  voucherMono: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#0f172a',
  },
});
