import { useState, useEffect } from 'react';
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
import { DiscoveryFeedFilters, ShiftCategory } from '@opskil/shared';
import {
  X,
  MapPin,
  Tag,
  IndianRupee,
  Award,
  Calendar,
  Clock,
  Utensils,
  Zap,
  RotateCcw,
  CheckCircle2,
  PlusCircle,
  Check,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { MUMBAI_ZONES, LocalityZone } from '../utils/location';

export interface FilterSheetProps {
  visible: boolean;
  currentFilters: DiscoveryFeedFilters;
  currentZone: LocalityZone | null;
  onClose: () => void;
  onApplyFilters: (filters: DiscoveryFeedFilters, zone: LocalityZone) => void;
  onResetFilters: () => void;
  availableShiftCount?: number;
}

const LOCALITY_CLUSTERS: { id: string; label: string; zoneId: string }[] = [
  { id: 'all', label: 'All Mumbai', zoneId: 'all' },
  { id: 'bkc', label: 'BKC Complex', zoneId: 'bkc' },
  { id: 'nesco', label: 'NESCO / Goregaon E', zoneId: 'goregaon' },
  { id: 'lower_parel', label: 'Lower Parel / Worli', zoneId: 'lower_parel' },
  { id: 'andheri', label: 'Andheri / Powai', zoneId: 'andheri' },
  { id: 'sobo', label: 'South Mumbai / Nariman', zoneId: 'sobo' },
];

const ROLES: { id: string; label: string; description: string; category: ShiftCategory }[] = [
  { id: 'hospitality', label: 'Guest Relations & Hospitality', description: 'VIP concierge, lounge host, delegate check-in', category: 'hospitality' },
  { id: 'registration', label: 'Registration & Badge Desk', description: 'Kiosk scanner, spot accreditation printing', category: 'support' },
  { id: 'operations', label: 'Venue Ops & Logistics', description: 'Load-in coordination, wristband dispatch, queue flow', category: 'corporate' },
  { id: 'production', label: 'AV / Production Assist', description: 'Console runner, cue card assist, mic handoffs', category: 'activation' },
  { id: 'ushering', label: 'VIP Ushering', description: 'Auditorium seating control, greenroom escort', category: 'hospitality' },
];

const SHIFT_WAGE_PILLS = [
  { label: '₹1.5k+', value: 1500, tier: 'Entry' },
  { label: '₹2.0k+', value: 2000, tier: 'Standard' },
  { label: '₹2.5k+', value: 2500, tier: 'Prime' },
  { label: '₹3.0k+', value: 3000, tier: 'Lead' },
];

const HOURLY_WAGE_PILLS = [
  { label: '₹150+/hr', value: 150, tier: 'Entry' },
  { label: '₹200+/hr', value: 200, tier: 'Standard' },
  { label: '₹250+/hr', value: 250, tier: 'Prime' },
  { label: '₹300+/hr', value: 300, tier: 'Lead' },
];

export function FilterSheet({
  visible,
  currentFilters,
  currentZone,
  onClose,
  onApplyFilters,
  onResetFilters,
  availableShiftCount = 14,
}: FilterSheetProps) {
  const { colors, spacing, radii, typography } = useOpsklTheme();

  const [wageBasis, setWageBasis] = useState<'shift' | 'hour'>('shift');
  const [minWage, setMinWage] = useState<number>(currentFilters.minWage || 0);
  const [selectedZone, setSelectedZone] = useState<LocalityZone>(
    currentZone || MUMBAI_ZONES[0]
  );
  const [selectedCategory, setSelectedCategory] = useState<ShiftCategory | 'all'>(
    currentFilters.category || 'all'
  );
  const [selectedRole, setSelectedRole] = useState<string>(
    currentFilters.requiredSkill || 'all'
  );
  const [selectedDay, setSelectedDay] = useState<string>('any');
  const [selectedSlot, setSelectedSlot] = useState<string>('any');
  const [fnbRequired, setFnbRequired] = useState<boolean>(false);
  const [instantPayoutOnly, setInstantPayoutOnly] = useState<boolean>(false);

  // Sync state when sheet opens
  useEffect(() => {
    if (!visible) return;
    setMinWage(currentFilters.minWage || 0);
    setSelectedZone(currentZone || MUMBAI_ZONES[0]);
    setSelectedCategory(currentFilters.category || 'all');
    setSelectedRole(currentFilters.requiredSkill || 'all');
  }, [visible, currentFilters, currentZone]);

  const handleApply = () => {
    onApplyFilters(
      {
        category: selectedCategory,
        minWage: minWage > 0 ? minWage : undefined,
        zone: selectedZone.id === 'all' ? undefined : selectedZone.label,
        requiredSkill: selectedRole === 'all' ? undefined : selectedRole,
      },
      selectedZone
    );
    onClose();
  };

  const handleReset = () => {
    setWageBasis('shift');
    setMinWage(0);
    setSelectedZone(MUMBAI_ZONES[0]);
    setSelectedCategory('all');
    setSelectedRole('all');
    setSelectedDay('any');
    setSelectedSlot('any');
    setFnbRequired(false);
    setInstantPayoutOnly(false);
    onResetFilters();
    onClose();
  };

  const currentWagePills = wageBasis === 'shift' ? SHIFT_WAGE_PILLS : HOURLY_WAGE_PILLS;

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
        {/* Sticky Header Bar */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close filter sheet"
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
            <View>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Filter Shifts</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Mumbai Metropolitan Region
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.resetBtn,
              { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
          >
            <RotateCcw size={13} color={colors.primary} strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Reset All</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {/* Section 1: Wage Basis & Minimum Pay */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IndianRupee size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Wage Basis & Minimum Pay
                </Text>
              </View>
              <Badge label="Guaranteed Base" variant="primary" size="sm" />
            </View>

            {/* Wage Basis Toggle */}
            <View style={[styles.basisToggleRow, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
              <Pressable
                onPress={() => setWageBasis('shift')}
                style={[
                  styles.basisBtn,
                  {
                    backgroundColor: wageBasis === 'shift' ? colors.surface : 'transparent',
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <Calendar size={14} color={wageBasis === 'shift' ? colors.primary : colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: wageBasis === 'shift' ? '700' : '500',
                    color: wageBasis === 'shift' ? colors.textPrimary : colors.textSecondary,
                  }}
                >
                  Per Shift (₹)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setWageBasis('hour')}
                style={[
                  styles.basisBtn,
                  {
                    backgroundColor: wageBasis === 'hour' ? colors.surface : 'transparent',
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <Clock size={14} color={wageBasis === 'hour' ? colors.primary : colors.textSecondary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: wageBasis === 'hour' ? '700' : '500',
                    color: wageBasis === 'hour' ? colors.textPrimary : colors.textSecondary,
                  }}
                >
                  Per Hour (₹/hr)
                </Text>
              </Pressable>
            </View>

            {/* Wage Display */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>Target Minimum Wage</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>
                {minWage > 0 ? (wageBasis === 'shift' ? `₹${minWage.toLocaleString()}+` : `₹${minWage}+/hr`) : 'Any Base Rate'}
              </Text>
            </View>

            {/* Wage Pills Grid */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {currentWagePills.map((pill) => {
                const isSelected = minWage === pill.value;
                return (
                  <Pressable
                    key={pill.value}
                    onPress={() => setMinWage(isSelected ? 0 : pill.value)}
                    style={[
                      styles.wagePill,
                      {
                        flex: 1,
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isSelected ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      {pill.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '500',
                        color: isSelected ? colors.textInverse : colors.textSecondary,
                        opacity: isSelected ? 0.9 : 0.8,
                      }}
                    >
                      {pill.tier}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, padding: 8, borderRadius: radii.sm }}>
              <ShieldCheck size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, flex: 1 }}>
                All displayed rates are guaranteed base pay before event surge & overtime multipliers.
              </Text>
            </View>
          </View>

          {/* Section 2: Mumbai Locality / Cluster */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Mumbai Locality / Cluster
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                {selectedZone.id === 'all' ? 'All Mumbai' : selectedZone.coords.name || selectedZone.label}
              </Text>
            </View>

            {/* Locality Cluster Pills */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LOCALITY_CLUSTERS.map((loc) => {
                const zoneObj = MUMBAI_ZONES.find((z) => z.id === loc.zoneId) || MUMBAI_ZONES[0];
                const isSelected = selectedZone.id === zoneObj.id;
                return (
                  <Pressable
                    key={loc.id}
                    onPress={() => setSelectedZone(zoneObj)}
                    style={[
                      styles.clusterPill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radii.full,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={14} color={colors.textInverse} />
                    ) : (
                      <PlusCircle size={14} color={colors.textSecondary} />
                    )}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? colors.textInverse : colors.textPrimary,
                      }}
                    >
                      {loc.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ backgroundColor: colors.surfaceMuted, padding: 8, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Showing geo-fenced verified venues within Mumbai Metropolitan Region.
              </Text>
            </View>
          </View>

          {/* Section 3: Role Specialization */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Award size={18} color={colors.primary} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                  Role Specialization
                </Text>
              </View>
              <Pressable onPress={() => { setSelectedCategory('all'); setSelectedRole('all'); }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
                  {selectedCategory === 'all' && selectedRole === 'all' ? 'All Roles Active' : 'Clear Role'}
                </Text>
              </Pressable>
            </View>

            {/* Roles List */}
            <View style={{ gap: 8 }}>
              {ROLES.map((role) => {
                const isSelected = selectedCategory === role.category || selectedRole === role.id;
                return (
                  <Pressable
                    key={role.id}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedCategory('all');
                        setSelectedRole('all');
                      } else {
                        setSelectedCategory(role.category);
                        setSelectedRole(role.id);
                      }
                    }}
                    style={[
                      styles.roleRow,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: radii.md,
                        borderColor: isSelected ? colors.primary : 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.roleCheckbox,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: 4,
                        },
                      ]}
                    >
                      {isSelected && <Check size={13} color={colors.textInverse} strokeWidth={3} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {role.label}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                        {role.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section 4: Shift Timing & Schedule */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Shift Timing & Schedule
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted }}>
                Target Day
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { id: 'any', label: 'Any Day' },
                  { id: 'today', label: 'Today (IST)' },
                  { id: 'tomorrow', label: 'Tomorrow' },
                  { id: 'weekend', label: 'Weekend' },
                ].map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setSelectedDay(d.id)}
                    style={[
                      styles.scheduleDayPill,
                      {
                        flex: 1,
                        backgroundColor: selectedDay === d.id ? colors.primary : colors.surfaceMuted,
                        borderColor: colors.border,
                        borderRadius: radii.sm,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: selectedDay === d.id ? colors.textInverse : colors.textPrimary,
                        textAlign: 'center',
                      }}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted }}>
                Time Slot
              </Text>
              <View style={{ gap: 6 }}>
                {[
                  { id: 'any', label: 'All Shift Timings', desc: 'Morning, afternoon and evening' },
                  { id: 'morning', label: 'Morning Shift', desc: 'Starts before 10:00 AM IST' },
                  { id: 'evening', label: 'Afternoon / Evening', desc: '12:00 PM – 09:00 PM IST' },
                ].map((slot) => {
                  const isSelected = selectedSlot === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => setSelectedSlot(slot.id)}
                      style={[
                        styles.slotBtn,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderRadius: radii.md,
                          borderColor: isSelected ? colors.primary : 'transparent',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                          {slot.label}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary }}>{slot.desc}</Text>
                      </View>
                      {isSelected && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Section 5: Amenities & Perks */}
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Tag size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Organizer Perks & Amenities
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setFnbRequired(!fnbRequired)}
                style={[
                  styles.amenityCard,
                  {
                    flex: 1,
                    backgroundColor: fnbRequired ? colors.primary : colors.surfaceMuted,
                    borderRadius: radii.md,
                    borderColor: fnbRequired ? colors.primary : colors.border,
                  },
                ]}
              >
                <Utensils size={18} color={fnbRequired ? colors.textInverse : colors.primary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: fnbRequired ? colors.textInverse : colors.textPrimary,
                    marginTop: 6,
                  }}
                >
                  F&B Provided
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: fnbRequired ? colors.textInverse : colors.textSecondary,
                    opacity: fnbRequired ? 0.9 : 0.8,
                  }}
                >
                  Crew meals on site
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setInstantPayoutOnly(!instantPayoutOnly)}
                style={[
                  styles.amenityCard,
                  {
                    flex: 1,
                    backgroundColor: instantPayoutOnly ? colors.primary : colors.surfaceMuted,
                    borderRadius: radii.md,
                    borderColor: instantPayoutOnly ? colors.primary : colors.border,
                  },
                ]}
              >
                <Zap size={18} color={instantPayoutOnly ? colors.textInverse : colors.primary} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: instantPayoutOnly ? colors.textInverse : colors.textPrimary,
                    marginTop: 6,
                  }}
                >
                  Instant Payout
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: instantPayoutOnly ? colors.textInverse : colors.textSecondary,
                    opacity: instantPayoutOnly ? 0.9 : 0.8,
                  }}
                >
                  UPI within 24h
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Action Bar */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                {availableShiftCount > 0 ? `${availableShiftCount} shifts ready` : '0 shifts found'}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              Mumbai • Guaranteed base payouts
            </Text>
          </View>

          <Button
            title="Apply Filters"
            variant="primary"
            size="md"
            onPress={handleApply}
            icon={<ArrowRight size={16} color={colors.textInverse} />}
          />
        </View>
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
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionCard: {
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  basisToggleRow: {
    flexDirection: 'row',
    padding: 3,
    gap: 4,
  },
  basisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  wagePill: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  clusterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  roleCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleDayPill: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  slotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  amenityCard: {
    padding: 12,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});

