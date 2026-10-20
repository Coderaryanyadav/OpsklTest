import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Badge,
  Button,
  FileText,
  useAuth,
  Screen,
  ScreenHeader,
  ErrorRetry,
  EmptyState,
  FinancialSummary,
  SegmentedControl,
  StatusIndicator,
  LoadingView,
  OpsklAlert,
  InlineBanner,
} from '@opskil/design-system';
import {
  formatINR,
  fetchOrganizerFinancesSummary,
  fetchOrganizerProfile,
  fetchOrganizerJobs,
  generateJobInvoiceSafe,
  OrganizerFinancesSummary,
  OrganizerInvoice,
  OrganizerProfile,
  Job,
} from '@opskil/shared';

type ActiveView = 'invoices' | 'reconciliation' | 'analytics';

export default function OrganizerFinancesScreen() {
  const router = useRouter();
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { session } = useAuth();

  const [finances, setFinances] = useState<OrganizerFinancesSummary | null>(null);
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [organizerJobs, setOrganizerJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('invoices');

  const [selectedInvoice, setSelectedInvoice] = useState<OrganizerInvoice | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingForJobId, setGeneratingForJobId] = useState<string | null>(null);

  const organizerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const [data, profile, jobs] = await Promise.all([
        fetchOrganizerFinancesSummary(organizerId),
        fetchOrganizerProfile(organizerId),
        fetchOrganizerJobs(organizerId),
      ]);
      setFinances(data);
      setOrganizerProfile(profile);
      setOrganizerJobs(jobs || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load financial ledgers. Pull to refresh or retry.');
      setFinances(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleGenerateInvoice = async (jobId: string) => {
    if (!organizerId) return;
    setGeneratingForJobId(jobId);
    try {
      const res = await generateJobInvoiceSafe(jobId, organizerId);
      if (res.success) {
        OpsklAlert.alert(
          'Invoice Generated',
          `Invoice #${res.invoiceNumber || ''} generated. Amount: ${formatINR(res.totalPayable || 0)}`
        );
        await loadData();
        setShowGenerateModal(false);
      } else {
        OpsklAlert.alert('Invoice Failed', res.error || 'Failed to generate shift invoice.');
      }
    } catch (err: any) {
      OpsklAlert.alert('Error', err?.message || 'Error generating invoice.');
    } finally {
      setGeneratingForJobId(null);
    }
  };

  const totalSlotsRequested = organizerJobs.reduce((acc, j) => acc + (j.slotsTotal || 0), 0);
  const totalSlotsFilled = organizerJobs.reduce((acc, j) => acc + (j.slotsFilled || 0), 0);
  const fillRatePct =
    totalSlotsRequested > 0 ? Math.round((totalSlotsFilled / totalSlotsRequested) * 100) : null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Finances & Invoices"
        subtitle="Staffing billing ledgers • Itemized shift statements"
        rightAction={
          <StatusIndicator
            label={organizerProfile?.gstin ? 'GST Registered' : 'Unregistered'}
            tone={organizerProfile?.gstin ? 'success' : 'neutral'}
            size="sm"
          />
        }
      />

      {!organizerId ? (
        <EmptyState
          icon={<FileText size={28} color={colors.textMuted} strokeWidth={2} />}
          title="Sign in to access organization finances"
          description="Review staffing spend, invoice history, GST breakdowns, and wage disbursements."
          actionLabel="Sign In as Organizer"
          onAction={() => router.push('/auth/login?redirect=/(tabs)/finances' as any)}
        />
      ) : loading ? (
        <LoadingView message="Loading financial ledgers…" />
      ) : loadError ? (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <ErrorRetry
            variant="block"
            title="Finances unavailable"
            message={loadError}
            onRetry={loadData}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <FinancialSummary
            title="Staffing spend overview"
            items={[
              {
                label: 'Total settled in escrow',
                amountLabel: formatINR(finances?.settledAmount || 0),
              },
              {
                label: 'Outstanding escrow due',
                amountLabel: formatINR(finances?.outstandingEscrowDue || 0),
                emphasis: (finances?.outstandingEscrowDue || 0) > 0 ? 'strong' : 'muted',
              },
              {
                label: 'Worker wages (pass-through)',
                amountLabel: formatINR(finances?.workerWageTotals || 0),
              },
              {
                label: 'Platform facilitation fee',
                amountLabel: formatINR(finances?.opskilServiceFees || 0),
                emphasis: 'muted',
              },
              {
                label: 'GST on facilitation fee',
                amountLabel: formatINR(finances?.applicableTaxes || 0),
                emphasis: 'muted',
              },
            ]}
            totalLabel="Total staffing spend (all-time)"
            totalAmountLabel={formatINR(finances?.totalPayableAllTime || 0)}
            footnote={
              (finances?.invoices || []).length === 0
                ? 'No invoices issued yet.'
                : finances?.reconciliationLogs?.some((l) => l.status === 'discrepancy')
                  ? 'At least one reconciliation discrepancy needs review.'
                  : (finances?.outstandingEscrowDue || 0) > 0
                    ? 'Escrow funding still pending on one or more invoices.'
                    : 'Ledger reconciled from generated invoices only.'
            }
          />

          <SegmentedControl
            options={[
              { value: 'invoices', label: `Invoices (${finances?.invoices.length || 0})` },
              { value: 'reconciliation', label: 'Reconcile' },
              { value: 'analytics', label: 'Fill rates' },
            ]}
            value={activeView}
            onChange={setActiveView}
          />

          <InlineBanner
            variant="info"
            title="Pilot settlement notice"
            message="Invoices are generated on-demand from confirmed crew (wages + 10% platform fee + 18% GST). Payouts settle to verified UPI after supervisor sign-off."
          />

          {activeView === 'invoices' ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Billing statements
                </Text>
                <Button
                  title="+ Generate"
                  variant="primary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setShowGenerateModal(true)}
                />
              </View>

              {(finances?.invoices || []).length === 0 ? (
                <EmptyState
                  icon={<FileText size={24} color={colors.textMuted} strokeWidth={1.8} />}
                  title="No invoices issued yet"
                  description="After shift attendance and escrow settlement, GST invoices will appear here."
                  actionLabel="View Published Shifts"
                  onAction={() => router.push('/(tabs)' as any)}
                />
              ) : (
                (finances?.invoices || []).map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedInvoice(inv)}
                    accessibilityRole="button"
                    accessibilityLabel={`Invoice ${inv.invoiceNumber}`}
                  >
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radii.md,
                        padding: spacing.md,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                              {inv.invoiceNumber}
                            </Text>
                            {inv.isSandbox ? <Badge label="SANDBOX" variant="neutral" size="sm" /> : null}
                          </View>
                          <Text
                            style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}
                            numberOfLines={2}
                          >
                            {inv.jobTitle}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            {inv.slotsCount} workers • Wages {formatINR(inv.wageTotal)} + Fee{' '}
                            {formatINR(inv.platformFee)} + GST {formatINR(inv.gstAmount)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
                            {formatINR(inv.totalPayable)}
                          </Text>
                          <StatusIndicator
                            label={
                              inv.status === 'escrow_funded' ? 'Funded in escrow' : inv.status.replace('_', ' ')
                            }
                            tone={inv.status === 'escrow_funded' ? 'success' : 'warning'}
                            size="sm"
                            style={{ marginTop: 6 }}
                          />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : activeView === 'reconciliation' ? (
            <View style={{ gap: spacing.sm }}>
              {(finances?.reconciliationLogs || []).length === 0 ? (
                <EmptyState
                  title="No reconciliation logs"
                  description={
                    (finances?.invoices || []).length === 0
                      ? 'No invoices or reconciliation logs recorded yet.'
                      : 'All provider transactions matched. No discrepancies detected.'
                  }
                />
              ) : (
                (finances?.reconciliationLogs || []).map((log) => (
                  <View
                    key={log.id}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                          Ref: {log.referenceId}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {log.notes || 'Transaction reconciled'}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <StatusIndicator
                        label={log.status}
                        tone={log.status === 'matched' ? 'success' : 'danger'}
                        size="sm"
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  gap: spacing.md,
                }}
              >
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Computed from your shifts</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                  Only fill rates derived from your posted jobs are shown. Attendance, cost variance, and loyalty
                  analytics are not available until those metrics are computed from live attendance data.
                </Text>

                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.md,
                    borderRadius: radii.md,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textMuted,
                      textTransform: 'uppercase',
                      fontWeight: '700',
                    }}
                  >
                    Staffing fill rate
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                    {fillRatePct == null ? '—' : `${fillRatePct}%`}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {totalSlotsRequested === 0
                      ? 'No shifts posted yet'
                      : `${totalSlotsFilled} of ${totalSlotsRequested} spots confirmed`}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                  letterSpacing: 0.5,
                }}
              >
                Shift-by-shift fill
              </Text>

              {organizerJobs.length === 0 ? (
                <EmptyState
                  title="No shifts posted yet"
                  description="Once you publish shifts, fill rates for each posting appear here."
                />
              ) : (
                organizerJobs.map((jobItem) => {
                  const jobFillPct =
                    (jobItem.slotsTotal || 0) > 0
                      ? Math.round(((jobItem.slotsFilled || 0) / (jobItem.slotsTotal || 1)) * 100)
                      : 100;
                  return (
                    <View
                      key={jobItem.id}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radii.md,
                        padding: spacing.md,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text
                            style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}
                            numberOfLines={2}
                          >
                            {jobItem.title}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                            {jobItem.date} • {jobItem.durationHours}h • {jobItem.zone}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                            Hourly {formatINR(jobItem.hourlyRate)} • Est. pay/worker{' '}
                            {formatINR(jobItem.totalPay || jobItem.hourlyRate * jobItem.durationHours)}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <StatusIndicator
                            label={`${jobItem.slotsFilled || 0}/${jobItem.slotsTotal || 0} filled`}
                            tone={jobFillPct === 100 ? 'success' : 'neutral'}
                            size="sm"
                          />
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>{jobFillPct}% fill</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={!!selectedInvoice} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}
        accessibilityViewIsModal
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.xl,
              maxHeight: '90%',
              gap: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Staffing Tax Invoice</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {selectedInvoice?.invoiceNumber}
                </Text>
              </View>
              <Button title="Close" variant="ghost" size="sm" fullWidth={false} onPress={() => setSelectedInvoice(null)} />
            </View>

            {selectedInvoice ? (
              <ScrollView contentContainerStyle={{ gap: spacing.md }}>
                <FinancialSummary
                  title={selectedInvoice.jobTitle}
                  items={[
                    {
                      label: `Agreed shift wages (${selectedInvoice.slotsCount} workers)`,
                      amountLabel: formatINR(selectedInvoice.wageTotal),
                    },
                    {
                      label: 'Opskl marketplace service fee (10%)',
                      amountLabel: formatINR(selectedInvoice.platformFee),
                      emphasis: 'muted',
                    },
                    {
                      label: 'IGST @ 18% (or CGST+SGST)',
                      amountLabel: formatINR(selectedInvoice.gstAmount),
                      emphasis: 'muted',
                    },
                  ]}
                  totalLabel="Total invoice payable"
                  totalAmountLabel={formatINR(selectedInvoice.totalPayable)}
                />
                <Button title="Close Invoice Statement" variant="primary" onPress={() => setSelectedInvoice(null)} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGenerateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenerateModal(false)} accessibilityViewIsModal
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.xl,
              maxHeight: '85%',
              gap: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Generate Shift Invoice</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Select a shift to compute the GST billing statement
                </Text>
              </View>
              <Button
                title="Close"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowGenerateModal(false)}
              />
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: 20 }}>
              {organizerJobs.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20 }}>
                  No shifts found. Post a shift to generate invoices.
                </Text>
              ) : (
                organizerJobs.map((j) => (
                  <View
                    key={j.id}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}
                          numberOfLines={2}
                        >
                          {j.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {j.date} • {j.slotsTotal} workers • {formatINR(j.hourlyRate)}/hr
                        </Text>
                      </View>
                      <StatusIndicator label={j.status} tone="neutral" size="sm" />
                    </View>

                    <Button
                      title={generatingForJobId === j.id ? 'Computing…' : 'Generate Invoice'}
                      variant="primary"
                      size="sm"
                      disabled={generatingForJobId === j.id}
                      loading={generatingForJobId === j.id}
                      onPress={() => handleGenerateInvoice(j.id)}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
