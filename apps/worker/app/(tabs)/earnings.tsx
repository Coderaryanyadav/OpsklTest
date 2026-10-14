import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useOpsklTheme,
  Card,
  Badge,
  WageText,
  Button,
  ShiftCardSkeleton,
} from '@opskil/design-system';
import {
  formatINR,
  fetchWorkerEarningsSummary,
  WorkerEarningsSummary,
  PaymentRecord,
  isValidIndianUpiId,
  updateWorkerProfile,
} from '@opskil/shared';
import { useAuth } from '@opskil/design-system';
import {
  ShieldCheck,
  CreditCard,
  ChevronRight,
  X,
  Receipt,
} from 'lucide-react-native';

type LedgerFilter = 'all' | 'settled' | 'pending' | 'failed' | 'disputed';

export default function WorkerEarningsScreen() {
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { session } = useAuth();

  const [summary, setSummary] = useState<WorkerEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [upiError, setUpiError] = useState('');
  const [upiSuccess, setUpiSuccess] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);

  const workerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!workerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await fetchWorkerEarningsSummary(workerId);
      setSummary(data);
      if (data?.defaultUpiId) {
        setUpiInput(data.defaultUpiId);
      }
    } catch {
      // Fallback handled in service
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveUpi = async () => {
    const trimmed = upiInput.trim();
    if (!isValidIndianUpiId(trimmed)) {
      setUpiError('Please enter a valid Indian UPI handle (e.g. name@bank)');
      return;
    }
    setUpiError('');
    setSavingUpi(true);
    try {
      if (workerId) {
        await updateWorkerProfile(workerId, { upiId: trimmed });
      }
      if (summary) {
        setSummary({ ...summary, defaultUpiId: trimmed });
      }
      setUpiSuccess(true);
      setTimeout(() => {
        setUpiSuccess(false);
        setShowUpiModal(false);
      }, 1000);
    } catch (err: any) {
      setUpiError(err?.message || 'Failed to save UPI handle. Please try again.');
    } finally {
      setSavingUpi(false);
    }
  };

  const filteredRecords = (summary?.records || []).filter((r) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'settled') return r.status === 'settled';
    if (activeFilter === 'pending')
      return r.status === 'escrow_locked' || r.status === 'processing' || r.status === 'pending';
    if (activeFilter === 'failed') return r.status === 'failed';
    if (activeFilter === 'disputed') return r.status === 'refunded';
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 14,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text
            style={[
              typography.h2,
              {
                color: colors.textPrimary,
                fontWeight: '700',
                letterSpacing: -0.5,
              },
            ]}
          >
            Earnings & Payouts
          </Text>

          <TouchableOpacity
            onPress={() => setShowUpiModal(true)}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.full,
              paddingHorizontal: 10,
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
            accessibilityRole="button"
            accessibilityLabel="Manage default payout UPI handle"
          >
            {summary?.defaultUpiId ? (
              <ShieldCheck size={12} color={colors.primary} strokeWidth={2.4} />
            ) : (
              <CreditCard size={12} color={colors.primary} strokeWidth={2.2} />
            )}
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.3, color: colors.primary }}>
              {summary?.defaultUpiId ? 'UPI LINKED' : 'ADD UPI'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 4,
            lineHeight: 18,
          }}
        >
          Direct UPI Settlement • Wages credited upon verified supervisor attendance sign-off
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <ShiftCardSkeleton />
          <ShiftCardSkeleton />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Main Balance Hero Card with Apple-Level Restraint */}
          <Card
            variant="elevated"
            style={{
              backgroundColor: '#000000',
              borderColor: '#262626',
              borderWidth: 1,
              borderRadius: radii.xl,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Total Settled Wages
                </Text>
                <WageText style={{ color: '#FFFFFF', fontSize: 34, lineHeight: 40, marginTop: 4 }}>
                  {formatINR(summary?.paidEarnings || 0)}
                </WageText>
              </View>
              <Badge label="SETTLED" variant="neutral" size="sm" />
            </View>

            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs }}>
              Direct transfer to linked UPI handle upon supervisor attendance verification
            </Text>

            {/* UPI Account strip */}
            <TouchableOpacity
              onPress={() => setShowUpiModal(true)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: radii.md,
                padding: spacing.sm + 4,
                marginTop: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
              }}
              accessibilityRole="button"
              accessibilityLabel="Change receiving bank UPI handle"
            >
              <View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Receiving Bank UPI Handle
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <ShieldCheck size={14} color="#FFFFFF" strokeWidth={2.4} />
                  <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '700', fontFamily: 'monospace' }}>
                    {summary?.defaultUpiId || 'Not linked yet'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>Change</Text>
                <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          </Card>

          {/* 5 Secondary Earnings Dimensions — Strict Monochrome */}
          <Text style={[typography.label, { color: colors.textMuted, marginTop: spacing.xs }]}>
            EARNINGS STATUS BREAKDOWN
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {/* Confirmed Upcoming */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                CONFIRMED UPCOMING
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(summary?.confirmedUpcomingWages || 0)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Locked in shift rosters
              </Text>
            </Card>

            {/* Completed Awaiting Approval */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                AWAITING SIGN-OFF
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(summary?.completedAwaitingApproval || 0)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Supervisor hours review
              </Text>
            </Card>

            {/* Approved Awaiting Payment */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>
                APPROVED IN DISBURSEMENT
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(summary?.approvedAwaitingPayment || 0)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Payout processing via UPI
              </Text>
            </Card>

            {/* Failed or Delayed */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                minWidth: '47%',
                backgroundColor: colors.surface,
                padding: spacing.md,
                borderColor: (summary?.failedDelayedPayments || 0) > 0 ? colors.danger : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: (summary?.failedDelayedPayments || 0) > 0 ? colors.danger : colors.textMuted,
                  fontWeight: '700',
                }}
              >
                FAILED / DELAYED
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: (summary?.failedDelayedPayments || 0) > 0 ? colors.danger : colors.textPrimary,
                  marginTop: 4,
                }}
              >
                {formatINR(summary?.failedDelayedPayments || 0)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {(summary?.failedDelayedPayments || 0) > 0 ? 'Tap to update UPI' : '0 delayed payouts'}
              </Text>
            </Card>

            {/* Disputed Amounts */}
            {(summary?.disputedAmounts || 0) > 0 && (
              <Card
                variant="outlined"
                style={{
                  width: '100%',
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  padding: spacing.md,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textPrimary, fontWeight: '700' }}>
                      DISPUTED WAGES UNDER REVIEW
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                      {formatINR(summary?.disputedAmounts || 0)}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Arbitration assigned • Held pending resolution
                    </Text>
                  </View>
                  <Badge label="IN DISPUTE" variant="neutral" size="sm" />
                </View>
              </Card>
            )}
          </View>

          {/* Ledger Section */}
          <View style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Shift Payout History</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {filteredRecords.length} records
              </Text>
            </View>

            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, marginVertical: spacing.sm }}
            >
              {(['all', 'settled', 'pending', 'failed'] as LedgerFilter[]).map((filter) => {
                const isSelected = activeFilter === filter;
                const label =
                  filter === 'all'
                    ? 'All Records'
                    : filter === 'settled'
                    ? 'Settled'
                    : filter === 'pending'
                    ? 'In Transit'
                    : 'Failed';

                return (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      borderRadius: radii.full,
                      backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Ledger List */}
            {filteredRecords.length === 0 ? (
              <Card variant="outlined" style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Text style={[typography.body, { color: colors.textMuted }]}>
                  No transaction records in this category.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {filteredRecords.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedRecord(item)}
                  >
                    <Card variant="outlined" style={{ padding: spacing.md }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: spacing.md }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                            {item.jobTitle || 'Event Shift'}
                          </Text>
                          {item.shiftHours && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              {item.shiftHours} hours on duty
                            </Text>
                          )}
                          {item.utrReference ? (
                            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                              UTR: {item.utrReference}
                            </Text>
                          ) : item.failureReason ? (
                            <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4, fontWeight: '600' }}>
                              Error: {item.failureReason}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 11, color: colors.info, marginTop: 4 }}>
                              Processing UPI disbursement...
                            </Text>
                          )}
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '800',
                              color:
                                item.status === 'settled'
                                  ? colors.success
                                  : item.status === 'failed'
                                  ? colors.danger
                                  : colors.primary,
                            }}
                          >
                            +{formatINR(item.netPayout)}
                          </Text>
                          <Badge
                            label={
                              item.status === 'settled'
                                ? 'SETTLED'
                                : item.status === 'failed'
                                ? 'FAILED'
                                : 'IN TRANSIT'
                            }
                            variant={
                              item.status === 'settled'
                                ? 'success'
                                : item.status === 'failed'
                                ? 'danger'
                                : 'primary'
                            }
                            size="sm"
                            style={{ marginTop: 6 }}
                          />
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Record Details Modal */}
      <Modal visible={!!selectedRecord} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.xl,
              maxHeight: '85%',
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Receipt size={20} color={colors.primary} strokeWidth={2.2} />
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Transaction Receipt</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedRecord(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close receipt modal"
              >
                <X size={20} color={colors.textMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <View style={{ gap: spacing.md }}>
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.md,
                    borderRadius: radii.md,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>NET DISBURSED AMOUNT</Text>
                  <Text style={{ fontSize: 32, fontWeight: '900', color: colors.success, marginTop: 4 }}>
                    {formatINR(selectedRecord.netPayout)}
                  </Text>
                  <Badge
                    label={selectedRecord.status.toUpperCase()}
                    variant={selectedRecord.status === 'settled' ? 'success' : 'primary'}
                    size="md"
                    style={{ marginTop: 6 }}
                  />
                </View>

                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Shift Title</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                      {selectedRecord.jobTitle || 'Event Shift'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Agreed Wage</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                      {formatINR(selectedRecord.amount)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Opskl Commission</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.success }}>
                      ₹0.00 (Zero Worker Fee)
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Receiving UPI Handle</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
                      {selectedRecord.upiId}
                    </Text>
                  </View>
                  {selectedRecord.utrReference && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>Bank UTR Reference</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {selectedRecord.utrReference}
                      </Text>
                    </View>
                  )}
                  {selectedRecord.settledAt && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>Settlement Time</Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        {new Date(selectedRecord.settledAt).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )}
                </View>

                <Button
                  title="Close Receipt"
                  variant="primary"
                  onPress={() => setSelectedRecord(null)}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit UPI Modal */}
      <Modal visible={showUpiModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.xl,
              gap: spacing.md,
            }}
          >
            <Text style={[typography.h3, { color: colors.textPrimary }]}>Default Payout UPI Handle</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              All shift wages are credited directly to this UPI Virtual Payment Address (VPA) via IMPS.
            </Text>

            <TextInput
              value={upiInput}
              onChangeText={(text) => {
                setUpiInput(text);
                setUpiError('');
              }}
              placeholder="e.g. mobile@upi or username@okhdfcbank"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: upiError ? colors.danger : colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
                fontSize: 16,
                color: colors.textPrimary,
                backgroundColor: colors.surfaceMuted,
              }}
            />

            {upiError ? (
              <Text style={{ color: colors.danger, fontSize: 12 }}>{upiError}</Text>
            ) : null}

            {upiSuccess ? (
              <Text style={{ color: colors.success, fontSize: 13, fontWeight: '700' }}>
                ✓ UPI handle verified and updated!
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowUpiModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={savingUpi ? 'Saving...' : 'Save & Verify'}
                variant="primary"
                loading={savingUpi}
                onPress={handleSaveUpi}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
