import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Screen,
  Checkbox,
} from '@opskil/design-system';
import {
  ChevronLeft,
  User as UserIcon,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  PhoneCall,
  CheckCircle2,
  Lock,
  Building,
  Radio,
} from 'lucide-react-native';

export default function EmergencyLockdownBroadcastScreen() {
  const { colors, spacing, radii } = useOpsklTheme();
  const router = useRouter();

  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      // Fallback
    });
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    Alert.alert(
      'Safety Protocol Confirmed',
      'Transit advisory updated with live railway and low-lying subway waterlogging status. Keep your phone active.'
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
            OPS PROTOCOL • IST
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
            Emergency Broadcast Detail
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

      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: 60 }}>
        {/* Critical Safety Broadcast Red Banner */}
        <View
          style={{
            backgroundColor: '#dc2626',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff', letterSpacing: 0.8 }}>
                CRITICAL SAFETY BROADCAST
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fee2e2' }}>
              14:18 IST
            </Text>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: '900',
              color: '#ffffff',
              lineHeight: 24,
              marginTop: 2,
            }}
          >
            EMERGENCY PROTOCOL ACTIVE • MARKETPLACE SUSPENDED
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fecaca' }}>
            Broadcast Reference #EMG-MUM-2025-08
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {/* Weather & Operational Status Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: '#fee2e2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldAlert size={20} color="#dc2626" />
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#dc2626', letterSpacing: 0.5 }}>
                    IMD ALERT LEVEL RED
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                    MMR Safety Curfew
                  </Text>
                </View>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.full,
                  backgroundColor: '#fee2e2',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#b91c1c' }}>
                  LOCKDOWN ENFORCED
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.lg,
                padding: spacing.sm + 2,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                DECLARED TRIGGER
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary, lineHeight: 18 }}>
                Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew
              </Text>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                    EFFECTIVE FROM
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 1 }}>
                    24 May 2025, 14:00 IST
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626', marginTop: 1 }}>
                    Until Further Notice
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                    AFFECTED RADIUS
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 1 }}>
                    All Mumbai Zones
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
                    South, Suburbs & Thane
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 }}>
              <AlertTriangle size={15} color="#dc2626" style={{ marginTop: 2 }} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1, lineHeight: 16 }}>
                <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Operational Scope: </Text>
                All open shift applications, new dispatches, and check-ins temporarily halted for worker safety.
              </Text>
            </View>
          </View>

          {/* 100% Wage Protection Guarantee Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={20} color="#1d4ed8" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                  100% Wage Protection Guarantee
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 }}>
                  PRE-FUNDED NODAL ESCROW ASSURED
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 18 }}>
              All workers currently on duty at venues will receive{' '}
              <Text style={{ fontWeight: '800' }}>100% of their contracted wage for today</Text>,
              pre-funded from nodal escrow. No penalty strikes or reliability deductions will occur due to transit disruption.
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.sm,
                borderRadius: radii.lg,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Wallet size={16} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textPrimary }}>
                  Instant Escrow Release
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                ₹ Fully Secured
              </Text>
            </View>
          </View>

          {/* Action Checklist for On-Site Crew */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} color="#dc2626" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 }}>
                  ACTION CHECKLIST FOR ON-SITE CREW
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radii.full,
                  backgroundColor: '#fee2e2',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#b91c1c' }}>
                  MANDATORY
                </Text>
              </View>
            </View>

            {/* Radar / Sensor Graphic Box */}
            <View
              style={{
                height: 90,
                borderRadius: radii.lg,
                backgroundColor: '#0f172a',
                padding: spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.full,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Radio size={14} color="#f87171" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>
                  LIVE SENSOR: TRANSIT RISK HIGH
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                Waterlogging detected across Central & Western railway lines
              </Text>
            </View>

            {/* Checklist Items */}
            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: spacing.sm,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Checkbox checked={check1} onChange={setCheck1} />
                <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1, lineHeight: 17 }}>
                  <Text style={{ fontWeight: '800' }}>Check in with floor supervisor</Text> at your venue before taking any action.
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: spacing.sm,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Checkbox checked={check2} onChange={setCheck2} />
                <Text style={{ fontSize: 12, color: colors.textPrimary, flex: 1, lineHeight: 17 }}>
                  <Text style={{ fontWeight: '800' }}>Verify transit safety before leaving;</Text> coordinate group dispersal if safe.
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: spacing.sm,
                  borderRadius: radii.md,
                  backgroundColor: '#fee2e2',
                }}
              >
                <AlertTriangle size={15} color="#dc2626" style={{ marginTop: 1 }} />
                <Text style={{ fontSize: 11, color: '#991b1b', flex: 1, lineHeight: 16 }}>
                  <Text style={{ fontWeight: '800' }}>Avoid danger points: </Text>
                  Do NOT attempt to travel through flooded low-lying corridors (Hindmata, Milan Subway, Kurla Depot).
                </Text>
              </View>
            </View>
          </View>

          {/* Venue Emergency Command Desks */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textPrimary }}>
                Venue Emergency Command Desks
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>
                MONITORED DISPATCH
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleCall('+912249108800')}
              style={styles.contactRow}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.contactIconBox}>
                  <Building size={16} color={colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    Jio World Convention Centre
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Emergency Command Desk
                  </Text>
                </View>
              </View>
              <PhoneCall size={16} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleCall('+912249108800')}
              style={styles.contactRow}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.contactIconBox}>
                  <Building size={16} color={colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                    NESCO Exhibition Disaster Cell
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    Goregaon Central Command
                  </Text>
                </View>
              </View>
              <PhoneCall size={16} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleCall('+912249108800')}
              style={[styles.contactRow, { backgroundColor: '#eff6ff' }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.contactIconBox, { backgroundColor: colors.primary }]}>
                  <PhoneCall size={16} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>
                    Mumbai Opskl Ground Support
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' }}>
                    +91 22 4910 8800
                  </Text>
                </View>
              </View>
              <PhoneCall size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Action Center (CTAs) */}
          <View style={{ gap: spacing.sm, marginTop: 4 }}>
            <TouchableOpacity
              onPress={handleAcknowledge}
              style={{
                minHeight: 48,
                borderRadius: radii.lg,
                backgroundColor: acknowledged ? '#16a34a' : colors.primary,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={18} color="#ffffff" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                {acknowledged
                  ? 'Safety Protocol Confirmed • Opening Map…'
                  : 'Acknowledge & View Safe Transit Advisory'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleCall('+912249108800')}
              style={{
                minHeight: 44,
                borderRadius: radii.lg,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <PhoneCall size={16} color="#dc2626" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Call Emergency Support Desk
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <Lock size={12} color={colors.textSecondary} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>
                AUTOMATED INCIDENT RECORD SYNCHRONIZED
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  contactIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
