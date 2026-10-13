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
import { useOpsklTheme, Button } from '@opskil/design-system';
import { DiscoveryFeedFilters, ShiftCategory } from '@opskil/shared';
import { X, MapPin, Tag, IndianRupee, Award } from 'lucide-react-native';
import { MUMBAI_ZONES, LocalityZone } from '../utils/location';

export interface FilterSheetProps {
  visible: boolean;
  currentFilters: DiscoveryFeedFilters;
  currentZone: LocalityZone | null;
  onClose: () => void;
  onApplyFilters: (filters: DiscoveryFeedFilters, zone: LocalityZone) => void;
  onResetFilters: () => void;
}

const CATEGORIES: { label: string; value: ShiftCategory | 'all' }[] = [
  { label: 'All Categories', value: 'all' },
  { label: 'Conference', value: 'conference' },
  { label: 'Exhibition', value: 'exhibition' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Activation', value: 'activation' },
  { label: 'Support', value: 'support' },
  { label: 'Hospitality', value: 'hospitality' },
];

const WAGE_TIERS: { label: string; value: number }[] = [
  { label: 'Any Daily Pay', value: 0 },
  { label: '₹1,200+ / day', value: 1200 },
  { label: '₹1,500+ / day', value: 1500 },
  { label: '₹1,800+ / day', value: 1800 },
  { label: '₹2,000+ / day', value: 2000 },
];

const SKILL_OPTIONS: string[] = [
  'All Skills',
  'Guest Relations',
  'Customer Service',
  'Crowd Management',
  'Backstage Etiquette',
  'Fluent English',
];

export function FilterSheet({
  visible,
  currentFilters,
  currentZone,
  onClose,
  onApplyFilters,
  onResetFilters,
}: FilterSheetProps) {
  const { colors, spacing, radii, typography, isDark } = useOpsklTheme();

  const [category, setCategory] = useState<ShiftCategory | 'all'>(
    currentFilters.category || 'all'
  );
  const [minWage, setMinWage] = useState<number>(currentFilters.minWage || 0);
  const [selectedZone, setSelectedZone] = useState<LocalityZone>(
    currentZone || MUMBAI_ZONES[0]
  );
  const [requiredSkill, setRequiredSkill] = useState<string>(
    currentFilters.requiredSkill || 'All Skills'
  );

  const handleApply = () => {
    onApplyFilters(
      {
        category,
        minWage: minWage > 0 ? minWage : undefined,
        zone: selectedZone.id === 'all' ? undefined : selectedZone.label,
        requiredSkill: requiredSkill === 'All Skills' ? undefined : requiredSkill,
      },
      selectedZone
    );
    onClose();
  };

  const handleReset = () => {
    setCategory('all');
    setMinWage(0);
    setSelectedZone(MUMBAI_ZONES[0]);
    setRequiredSkill('All Skills');
    onResetFilters();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Filter Shifts</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderRadius: radii.full, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <X size={18} color={colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          {/* Locality & Mumbai Zone Selection (Fallback) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MapPin size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Locality & Event Hub
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              Select your preferred Mumbai area to order shifts by proximity
            </Text>

            <View style={styles.chipsContainer}>
              {MUMBAI_ZONES.map((zone) => {
                const isSelected = selectedZone.id === zone.id;
                return (
                  <Pressable
                    key={zone.id}
                    onPress={() => setSelectedZone(zone)}
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
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? colors.textInverse : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {zone.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Shift Category */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Tag size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Shift Category
              </Text>
            </View>
            <View style={styles.chipsContainer}>
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
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? colors.textInverse : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Minimum Daily Pay */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <IndianRupee size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Minimum Daily Payout
              </Text>
            </View>
            <View style={styles.chipsContainer}>
              {WAGE_TIERS.map((tier) => {
                const isSelected = minWage === tier.value;
                return (
                  <Pressable
                    key={tier.value}
                    onPress={() => setMinWage(tier.value)}
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
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? colors.textInverse : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {tier.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Relevant Skill */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Award size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Required Skill Focus
              </Text>
            </View>
            <View style={styles.chipsContainer}>
              {SKILL_OPTIONS.map((skill) => {
                const isSelected = requiredSkill === skill;
                return (
                  <Pressable
                    key={skill}
                    onPress={() => setRequiredSkill(skill)}
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
                      style={[
                        styles.chipText,
                        {
                          color: isSelected ? colors.textInverse : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {skill}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Button title="Reset All" variant="secondary" size="lg" onPress={handleReset} />
          </View>
          <View style={{ flex: 1.5 }}>
            <Button title="Apply Filters" variant="primary" size="lg" onPress={handleApply} />
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
