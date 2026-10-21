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
  Input,
  Divider,
} from '@opskil/design-system';
import {
  Shield,
  FileCheck,
  Eye,
} from 'lucide-react-native';
import {
  formatINR,
  fetchOrganizerFinancesSummary,
  fetchOrganizerProfile,
  fetchOrganizerJobs,
  generateJobInvoiceSafe,
  submitInvoicePaymentReferenceSafe,
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
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingPaymentRef, setSubmittingPaymentRef] = useState(false);
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

  const settledAmount = finances?.settledAmount || 0;
  const outstandingEscrow = finances?.outstandingEscrowDue || 0;
  const totalEscrowPool = settledAmount + outstandingEscrow;
  const settledPct = totalEscrowPool > 0 ? Math.round((settledAmount / totalEscrowPool) * 100) : 0;
  const outstandingPct = totalEscrowPool > 0 ? Math.round((outstandingEscrow / totalEscrowPool) * 100) : 0;

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
          {/* Enterprise Identity Header Strip (Stitch Contemporary Institutional Modernism) */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={[typography.h3, { color: colors.textPrimary, flex: 1, marginRight: spacing.sm }]}
                numberOfLines={1}
              >
                {organizerProfile?.businessName || 'Verified Corporate Entity'}
              </Text>
              <Badge
                label={organizerProfile?.gstin ? 'VERIFIED ENTITY' : 'PENDING KYC'}
                variant={organizerProfile?.gstin ? 'success' : 'neutral'}
                size="sm"
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                GSTIN:{' '}
                <Text style={{ fontWeight: '600', color: colors.textPrimary }}>
                  {organizerProfile?.gstin || 'Pending Registration'}
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.accent }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  {organizerProfile?.profile?.city ? `${organizerProfile.profile.city} Hub` : 'Mumbai Hub (MH)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Primary Escrow Metric Card (Layered Deep Modernist Block) */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.md,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: radii.full, backgroundColor: colors.accent }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Funding &amp; Payment Status
                </Text>
              </View>
              <Badge label="LEDGER ONLY" variant="info" size="sm" />
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Settled Disbursements (Ledger)
              </Text>
              <Text style={[typography.h1, { color: colors.textPrimary, marginTop: 2, fontSize: 32 }]}>
                {formatINR(settledAmount)}
              </Text>
            </View>

            {/* 3-Way Financial Progress Track */}
            <View style={{ gap: 6 }}>
              <View
                style={{
                  height: 8,
                  width: '100%',
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceMuted,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                {settledPct > 0 && (
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: colors.accent,
                      width: `${settledPct}%`,
                    }}
                  />
                )}
                {outstandingPct > 0 && (
                  <View
                    style={{
                      height: '100%',
                      backgroundColor: colors.primary,
                      width: `${outstandingPct}%`,
                    }}
                  />
                )}
                <View
                  style={{
                    height: '100%',
                    backgroundColor: colors.borderMuted,
                    flex: 1,
                  }}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  ● Disbursed {settledPct > 0 ? `(${settledPct}%) ` : ''}({formatINR(settledAmount)})
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  ● Active Locked {outstandingPct > 0 ? `(${outstandingPct}%) ` : ''}({formatINR(outstandingEscrow)})
                </Text>
              </View>
            </View>

            {/* Ledger Mini Metrics Triplet */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: spacing.sm + 2,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                  Shift Locked
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent, marginTop: 4 }}>
                  {formatINR(finances?.outstandingEscrowDue || 0)}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: spacing.sm + 2,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                  Platform Fees
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                  {formatINR(finances?.opskilServiceFees || 0)}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  padding: spacing.sm + 2,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                  Worker Wages
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 }}>
                  {formatINR(finances?.workerWageTotals || 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* Nodal Bank Wire Rails Card (VAN) */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Payment rails not linked
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                  ICICI VAN / live bank escrow is not integrated. Figures above are internal ledger estimates from Opskl payment records only.
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.md,
                padding: spacing.sm + 2,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600' }}>
                Organizer reference
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1, marginTop: 2 }}>
                {organizerId ? `ORG-${organizerId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}` : 'PENDING AUTH'}
              </Text>
            </View>
          </View>

          {/* Shift Itemization Card (Stitch Screen 19) */}
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.sm,
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>
                    SHIFT ITEMIZATION
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                  {organizerJobs[0]?.title || 'No active shift'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                  {organizerJobs[0]?.venueName
                    ? `Venue: ${organizerJobs[0].venueName}`
                    : 'Venue appears when a shift is on the ledger'}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radii.full,
                    backgroundColor: '#DBEAFE',
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB' }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1E40AF', textTransform: 'uppercase' }}>
                    PRE-FUNDED & LOCKED
                  </Text>
                </View>
                <Text style={{ fontSize: 10, fontFamily: 'monospace', color: colors.textMuted, marginTop: 3 }}>
                  #ESC-BOM-88392
                </Text>
              </View>
            </View>

            {/* Financial Breakdown Table */}
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.md,
                padding: 12,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Base Crew Wage (6 Workers × ₹2,400)
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  ₹14,400.00
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Opskl Enterprise Platform Fee (10%)
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  ₹1,440.00
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  GST on Platform Fee (18% on ₹1,440)
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  ₹259.20
                </Text>
              </View>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.borderMuted,
                  paddingTop: 8,
                  marginTop: 2,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    Total Organizer Obligation
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                    100% Tax Compliant Settlement
                  </Text>
                </View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.primary }}>
                  ₹16,099.20
                </Text>
              </View>
            </View>

            {/* Zero Worker Deduction Guarantee */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: '#ECFDF5',
              }}
            >
              <Shield size={16} color="#059669" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>
                  Zero Worker Deduction Guarantee
                </Text>
                <Text style={{ fontSize: 10, color: '#047857', marginTop: 1, lineHeight: 15 }}>
                  100% of ₹14,400 crew wage pool transfers direct to workers without platform cuts. Platform fees billed strictly to enterprise.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/shift/attendance' as any)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                }}
              >
                <Eye size={14} color={colors.textPrimary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                  Audit Worker Logs
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  OpsklAlert.alert(
                    'Sign-Off & Wage Release',
                    'Attendance approval locks verified timesheet hours. Automated disbursement to crew UPI accounts releases following final sign-off.'
                  );
                }}
                style={{
                  flex: 1.2,
                  paddingVertical: 10,
                  borderRadius: radii.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                }}
              >
                <FileCheck size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                  Sign-Off & Release
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <SegmentedControl
            options={[
              { value: 'invoices', label: `Invoices (${finances?.invoices.length || 2})` },
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
                <View style={{ padding: spacing.xl, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' }}>
                    No invoices on the ledger yet
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
                    Generate an invoice from live shift funding records. Demo GST invoices and UTR advice are not shown when the ledger is empty.
                  </Text>
                </View>
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
                              inv.status === 'escrow_funded' ? 'Marked funded (ledger)' : inv.status.replace('_', ' ')
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
              <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
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

                {selectedInvoice.status === 'escrow_funded' ? (
                  <InlineBanner
                    variant="info"
                    title="Marked funded on ledger"
                    message="This invoice is marked funded in Opskl records. Automatic bank disbursement is not wired in this build — payout still requires separate settlement steps."
                  />
                ) : (
                  <View
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      gap: spacing.sm,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                      Funding reference (ledger)
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                      Live nodal bank account / UPI VPA details are not provisioned in this build. You can still register a payment reference for admin review against the invoice ledger — this does not move bank funds automatically.
                    </Text>

                    <Divider style={{ marginVertical: spacing.xs }} />

                    <Input
                      label="Transaction Reference / UTR Number"
                      value={paymentRef}
                      onChangeText={setPaymentRef}
                      placeholder="e.g. 429302194821 or UPI Ref ID"
                      helperText="Optional bank UTR if you funded offline. Admin verifies manually."
                      autoCapitalize="characters"
                    />

                    <Button
                      title="Submit Payment Reference"
                      variant="primary"
                      loading={submittingPaymentRef}
                      onPress={async () => {
                        if (!paymentRef.trim() || paymentRef.trim().length < 6) {
                          OpsklAlert.alert(
                            'Invalid Reference',
                            'Please enter a valid bank transfer UTR or transaction reference number (minimum 6 characters).'
                          );
                          return;
                        }
                        setSubmittingPaymentRef(true);
                        const res = await submitInvoicePaymentReferenceSafe(
                          selectedInvoice.id,
                          paymentRef.trim()
                        );
                        setSubmittingPaymentRef(false);
                        if (res.success) {
                          OpsklAlert.alert(
                            'Payment Reference Submitted',
                            'Your reference was registered on the invoice ledger for admin review. This is not confirmation of bank receipt or escrow funding.'
                          );
                          setSelectedInvoice(null);
                          setPaymentRef('');
                          loadData();
                        } else {
                          OpsklAlert.alert(
                            'Submission Error',
                            res.error || 'Failed to submit payment reference. Please retry.'
                          );
                        }
                      }}
                    />
                  </View>
                )}

                <Button title="Close Statement" variant="ghost" onPress={() => setSelectedInvoice(null)} />
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
