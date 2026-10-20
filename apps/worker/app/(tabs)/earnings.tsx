import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  Badge,
  WageText,
  Button,
  ShiftCardSkeleton,
  ErrorRetry,
  FinancialSummary,
  FilterPills,
  OpsklAlert,
  Input,
  KeyboardAwareContainer,
  StatusIndicator,
} from '@opskil/design-system';
import {
  formatINR,
  fetchWorkerEarningsSummary,
  WorkerEarningsSummary,
  PaymentRecord,
  isValidIndianUpiId,
  updateWorkerProfile,
  initiateWorkerPayoutSafe,
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
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { session } = useAuth();

  const [summary, setSummary] = useState<WorkerEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<PaymentRecord | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiInput, setUpiInput] = useState('');
  const [upiError, setUpiError] = useState('');
  const [upiSuccess, setUpiSuccess] = useState(false);
  const [savingUpi, setSavingUpi] = useState(false);
  const [initiatingPayout, setInitiatingPayout] = useState(false);

  const workerId = session?.user?.id;

  const handleInitiatePayout = async (record: PaymentRecord) => {
    if (!record.bookingId) {
      OpsklAlert.alert('Missing Reference', 'Missing booking reference for this payout record.');
      return;
    }
    const targetUpi = record.upiId || summary?.defaultUpiId;
    if (!targetUpi || !isValidIndianUpiId(targetUpi)) {
      setShowUpiModal(true);
      return;
    }

    setInitiatingPayout(true);
    try {
      const res = await initiateWorkerPayoutSafe(
        record.bookingId,
        targetUpi,
        `payout_${record.id}_${Date.now()}`
      );

      if (res.success) {
        OpsklAlert.alert('Payout Initiated', `Funds are being processed via UPI IMPS to ${targetUpi}`);
        await loadData();
        setSelectedRecord(null);
      } else {
        OpsklAlert.alert(
          'Payout Failed',
          res.error || 'Failed to initiate payout. Please ensure shift attendance has been completed and signed off.'
        );
      }
    } catch (err: any) {
      OpsklAlert.alert('Network Error', err?.message || 'Network error initiating payout.');
    } finally {
      setInitiatingPayout(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!workerId) {
      setLoading(false);
      setRefreshing(false);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const data = await fetchWorkerEarningsSummary(workerId);
      setSummary(data);
      if (data?.defaultUpiId) {
        setUpiInput(data.defaultUpiId);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load earnings. Pull to refresh or retry.');
      setSummary(null);
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

      {!workerId ? (
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.surfaceMuted,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Receipt size={28} color={colors.textPrimary} strokeWidth={2} />
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
            Sign In to Access Earnings
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 }}>
            Sign in with your worker account to view settled wages, track pending attendance reviews, manage your receiving bank UPI handle, and download disbursement receipts.
          </Text>
          <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 280 }}>
            <Button
              title="Sign In as Worker"
              variant="primary"
              size="md"
              onPress={() => router.push('/auth/login?redirect=/(tabs)/earnings' as any)}
            />
          </View>
        </View>
      ) : loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <ShiftCardSkeleton />
          <ShiftCardSkeleton />
        </View>
      ) : loadError ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          <ErrorRetry
            variant="block"
            title="Could Not Load Earnings"
            message={loadError}
            onRetry={loadData}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.xl,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Total Settled Wages
                </Text>
                <WageText style={{ color: colors.textPrimary, fontSize: 34, lineHeight: 40, marginTop: 4 }}>
                  {formatINR(summary?.paidEarnings || 0)}
                </WageText>
              </View>
              <StatusIndicator label="Settled" tone="success" />
            </View>

            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs }}>
              Direct transfer to linked UPI handle upon supervisor attendance verification
            </Text>

            <TouchableOpacity
              onPress={() => setShowUpiModal(true)}
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radii.md,
                padding: spacing.sm + 4,
                marginTop: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 48,
              }}
              accessibilityRole="button"
              accessibilityLabel="Change receiving bank UPI handle"
            >
              <View>
                <Text style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' }}>
                  Receiving Bank UPI Handle
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <ShieldCheck size={14} color={colors.primary} strokeWidth={2.4} />
                  <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '700', fontFamily: 'monospace' }}>
                    {summary?.defaultUpiId || 'Not linked yet'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Change</Text>
                <ChevronRight size={14} color={colors.primary} strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          </View>

          <FinancialSummary
            title="Earnings status breakdown"
            items={[
              {
                label: 'Confirmed upcoming',
                amountLabel: formatINR(summary?.confirmedUpcomingWages || 0),
              },
              {
                label: 'Awaiting sign-off',
                amountLabel: formatINR(summary?.completedAwaitingApproval || 0),
              },
              {
                label: 'Approved in disbursement',
                amountLabel: formatINR(summary?.approvedAwaitingPayment || 0),
              },
              {
                label: 'Failed / delayed',
                amountLabel: formatINR(summary?.failedDelayedPayments || 0),
                emphasis: (summary?.failedDelayedPayments || 0) > 0 ? 'strong' : 'muted',
              },
              ...((summary?.disputedAmounts || 0) > 0
                ? [
                    {
                      label: 'Disputed wages under review',
                      amountLabel: formatINR(summary?.disputedAmounts || 0),
                      emphasis: 'strong' as const,
                    },
                  ]
                : []),
            ]}
            totalLabel="Settled to date"
            totalAmountLabel={formatINR(summary?.paidEarnings || 0)}
            footnote="Amounts reflect real booking and payment records. No wallet balance is stored in-app."
          />

          {/* Ledger Section */}
          <View style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>Shift Payout History</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {filteredRecords.length} records
              </Text>
            </View>

            <FilterPills
              items={[
                { id: 'all', label: 'All Records' },
                { id: 'settled', label: 'Settled' },
                { id: 'pending', label: 'In Transit' },
                { id: 'failed', label: 'Failed' },
              ]}
              selectedId={activeFilter}
              onSelect={(id) => setActiveFilter(id as LedgerFilter)}
              contentContainerStyle={{ paddingHorizontal: 0, marginVertical: spacing.sm }}
            />

            {/* Ledger List */}
            {filteredRecords.length === 0 ? (
              <Card variant="outlined" style={{ padding: spacing.xl, alignItems: 'center', borderRadius: radii.xl }}>
                <Text style={[typography.subtitle, { color: colors.textPrimary, fontWeight: '700', textAlign: 'center' }]}>
                  {(summary?.records?.length || 0) === 0 ? 'No Shift Earnings Yet' : 'No Transactions Found'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 }}>
                  {(summary?.records?.length || 0) === 0
                    ? 'When you complete shifts and organizers verify your attendance, authoritative UPI disbursements and payment slips appear here.'
                    : `No records match the "${activeFilter}" filter.`}
                </Text>
                <View style={{ marginTop: spacing.md, width: '100%', maxWidth: 220 }}>
                  {(summary?.records?.length || 0) === 0 ? (
                    <Button
                      title="Find Available Shifts"
                      variant="primary"
                      size="sm"
                      onPress={() => router.push('/(tabs)' as any)}
                    />
                  ) : (
                    <Button
                      title="Show All Transactions"
                      variant="outline"
                      size="sm"
                      onPress={() => setActiveFilter('all')}
                    />
                  )}
                </View>
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
      <Modal
        visible={!!selectedRecord} transparent animationType="slide"
        accessibilityViewIsModal
      >
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

                {/* Pilot Escrow Settlement Notice */}
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.sm,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                    Opskl Pilot Settlement: Shift wages are safeguarded in nodal escrow. Admin processes payment directly to your verified UPI VPA within 24 hours of shift conclusion.
                  </Text>
                </View>

                {selectedRecord.status === 'escrow_locked' && (
                  <Button
                    title="Disbursement Queued (Escrow Secured)"
                    variant="secondary"
                    disabled={true}
                    onPress={() => {}}
                  />
                )}

                {selectedRecord.status === 'pending' && (
                  <Button
                    title={initiatingPayout ? 'Processing...' : 'Request Payout Review'}
                    variant="primary"
                    loading={initiatingPayout}
                    onPress={() => handleInitiatePayout(selectedRecord)}
                  />
                )}

                <Button
                  title="Close Receipt"
                  variant="outline"
                  onPress={() => setSelectedRecord(null)}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit UPI Modal */}
      <Modal
        visible={showUpiModal} transparent animationType="fade"
        accessibilityViewIsModal
      >
        <KeyboardAwareContainer
          contentContainerStyle={{
            flexGrow: 1,
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

            <Input
              label="UPI Handle"
              value={upiInput}
              onChangeText={(text) => {
                setUpiInput(text);
                setUpiError('');
              }}
              placeholder="e.g. mobile@upi or username@okhdfcbank"
              autoCapitalize="none"
              error={upiError || undefined}
            />

            {upiSuccess ? (
              <Text style={{ color: colors.success, fontSize: 13, fontWeight: '700' }}>
                UPI handle updated successfully.
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
        </KeyboardAwareContainer>
      </Modal>
    </SafeAreaView>
  );
}
