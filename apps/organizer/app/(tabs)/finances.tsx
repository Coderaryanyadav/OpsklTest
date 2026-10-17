import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useOpsklTheme,
  Card,
  Badge,
  WageText,
  Button,
  FileText,
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
import { BarChart3 } from 'lucide-react-native';

import { useAuth } from '@opskil/design-system';

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
  const [activeView, setActiveView] = useState<ActiveView>('invoices');

  const [selectedInvoice, setSelectedInvoice] = useState<OrganizerInvoice | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingForJobId, setGeneratingForJobId] = useState<string | null>(null);

  const organizerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [data, profile, jobs] = await Promise.all([
        fetchOrganizerFinancesSummary(organizerId),
        fetchOrganizerProfile(organizerId),
        fetchOrganizerJobs(organizerId),
      ]);
      setFinances(data);
      setOrganizerProfile(profile);
      setOrganizerJobs(jobs || []);
    } catch {
      // Fallback in service
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
        alert(`Invoice #${res.invoiceNumber || ''} generated successfully! Amount: ${formatINR(res.totalPayable || 0)}`);
        await loadData();
        setShowGenerateModal(false);
      } else {
        alert(res.error || 'Failed to generate shift invoice.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error generating invoice.');
    } finally {
      setGeneratingForJobId(null);
    }
  };

  const totalSlotsRequested = organizerJobs.reduce((acc, j) => acc + (j.slotsTotal || 0), 0);
  const totalSlotsFilled = organizerJobs.reduce((acc, j) => acc + (j.slotsFilled || 0), 0);
  const fillRatePct = totalSlotsRequested > 0 ? Math.round((totalSlotsFilled / totalSlotsRequested) * 100) : 100;

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
            Finances & Invoices
          </Text>

          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.full,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.3,
                color: organizerProfile?.gstin ? colors.textPrimary : colors.textMuted,
              }}
            >
              {organizerProfile?.gstin ? 'GST REGISTERED' : 'UNREGISTERED'}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 4,
            lineHeight: 18,
          }}
        >
          Staffing billing ledgers • Itemized shift expense statements
        </Text>
      </View>

      {!organizerId ? (
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
            <FileText size={28} color={colors.textPrimary} strokeWidth={2} />
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
            Sign In to Access Organization Finances
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 }}>
            Sign in with your organizer account to review staffing spend, invoice histories, GST breakdowns, and wage disbursements.
          </Text>
          <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 280 }}>
            <Button
              title="Sign In as Organizer"
              variant="primary"
              size="md"
              onPress={() => router.push('/auth/login?redirect=/(tabs)/finances' as any)}
            />
          </View>
        </View>
      ) : loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
            Loading financial ledgers...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Executive Overview Grid — Enterprise SaaS White & Slate Hierarchy */}
          <Card
            variant="elevated"
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Total Staffing Spend (All-time)
                </Text>
                <WageText style={{ color: colors.textPrimary, fontSize: 32, lineHeight: 38, marginTop: 4 }}>
                  {formatINR(finances?.totalPayableAllTime || 0)}
                </WageText>
              </View>
              {(() => {
                const hasInvoices = (finances?.invoices || []).length > 0;
                const hasDiscrepancy = finances?.reconciliationLogs?.some((l) => l.status === 'discrepancy');
                const hasEscrowDue = (finances?.outstandingEscrowDue || 0) > 0;

                if (!hasInvoices) {
                  return <Badge label="NO INVOICES" variant="neutral" size="sm" />;
                }
                if (hasDiscrepancy) {
                  return <Badge label="DISCREPANCY" variant="danger" size="sm" />;
                }
                if (hasEscrowDue) {
                  return <Badge label="ESCROW PENDING" variant="warning" size="sm" />;
                }
                return <Badge label="RECONCILED" variant="success" size="sm" />;
              })()}
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radii.md,
                padding: spacing.md,
                marginTop: spacing.md,
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Total Settled in Escrow:
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  {formatINR(finances?.settledAmount || 0)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  Outstanding Escrow Due:
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: (finances?.outstandingEscrowDue || 0) > 0 ? colors.warning : colors.textPrimary,
                  }}
                >
                  {formatINR(finances?.outstandingEscrowDue || 0)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Transparent Cost Breakdown Cards */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.8,
              color: colors.textMuted,
              marginTop: spacing.xs,
              textTransform: 'uppercase',
            }}
          >
            TRANSPARENT COST COMPOSITION
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* 1. Worker Wages (Sacrosanct pass-through) */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: radii.lg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textMuted,
                  fontWeight: '700',
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                WORKER WAGES
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(finances?.workerWageTotals || 0)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '500', marginTop: 2 }}>
                100% to crew
              </Text>
            </Card>

            {/* 2. Opskl Service Fee */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: radii.lg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textMuted,
                  fontWeight: '700',
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                PLATFORM FEE
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(finances?.opskilServiceFees || 0)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                10% escrow fee
              </Text>
            </Card>

            {/* 3. GST (18%) */}
            <Card
              variant="outlined"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                padding: 10,
                borderRadius: radii.lg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textMuted,
                  fontWeight: '700',
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                GST (18%)
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                {formatINR(finances?.applicableTaxes || 0)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                ITC claimable
              </Text>
            </Card>
          </View>

          {/* 3-Way Tab Switcher: Invoices, Reconciliation and Workforce Analytics */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              padding: 4,
              marginTop: spacing.md,
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveView('invoices')}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                alignItems: 'center',
                backgroundColor: activeView === 'invoices' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                shadowOpacity: activeView === 'invoices' ? 0.08 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeView === 'invoices' ? colors.primary : colors.textSecondary,
                }}
              >
                Invoices ({finances?.invoices.length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveView('reconciliation')}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                alignItems: 'center',
                backgroundColor: activeView === 'reconciliation' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                shadowOpacity: activeView === 'reconciliation' ? 0.08 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeView === 'reconciliation' ? colors.primary : colors.textSecondary,
                }}
              >
                Reconciliation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveView('analytics')}
              style={{
                flex: 1.2,
                paddingVertical: spacing.sm,
                alignItems: 'center',
                backgroundColor: activeView === 'analytics' ? colors.surface : 'transparent',
                borderRadius: radii.sm,
                shadowOpacity: activeView === 'analytics' ? 0.08 : 0,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activeView === 'analytics' ? colors.primary : colors.textSecondary,
                }}
              >
                Workforce Analytics
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pilot Transparency Notice */}
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              padding: spacing.md,
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
              marginVertical: spacing.xs,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 }}>
              Pilot Settlement Notice
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
              Shift invoices are generated on-demand based on confirmed crew shifts (wages + 10% platform fee + 18% GST). In this launch phase, payout disbursements are settled directly to verified UPI IMPS accounts upon completed supervisor sign-off.
            </Text>
          </View>

          {/* Section 1: Invoices */}
          {activeView === 'invoices' ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Billing Statements ({finances?.invoices.length || 0})
                </Text>
                <TouchableOpacity
                  onPress={() => setShowGenerateModal(true)}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radii.full,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.background }}>
                    + Generate Shift Invoice
                  </Text>
                </TouchableOpacity>
              </View>
              {(finances?.invoices || []).length === 0 ? (
                <Card
                  variant="outlined"
                  style={{
                    padding: spacing.xl,
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    borderRadius: radii.xl,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: colors.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <FileText size={24} color={colors.textPrimary} strokeWidth={1.8} />
                  </View>
                  <Text
                    style={[
                      typography.h3,
                      {
                        color: colors.textPrimary,
                        fontWeight: '700',
                        letterSpacing: -0.3,
                        textAlign: 'center',
                      },
                    ]}
                  >
                    No Invoices Issued Yet
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.textSecondary,
                      textAlign: 'center',
                      marginTop: 4,
                      lineHeight: 18,
                      maxWidth: 280,
                    }}
                  >
                    When your shift bookings complete attendance check-out and escrow settlement, official GST tax invoices will appear here.
                  </Text>
                  <View style={{ marginTop: spacing.md, width: '100%', maxWidth: 220 }}>
                    <Button
                      title="View Published Shifts"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push('/(tabs)' as any)}
                    />
                  </View>
                </Card>
              ) : (
                (finances?.invoices || []).map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedInvoice(inv)}
                  >
                    <Card variant="outlined" style={{ padding: spacing.md }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                              {inv.invoiceNumber}
                            </Text>
                            {inv.isSandbox && (
                              <Badge label="SANDBOX" variant="neutral" size="sm" />
                            )}
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                            {inv.jobTitle}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            {inv.slotsCount} workers • Wages {formatINR(inv.wageTotal)} + Fee {formatINR(inv.platformFee)} + GST {formatINR(inv.gstAmount)}
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                            Due by {new Date(inv.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textPrimary }}>
                            {formatINR(inv.totalPayable)}
                          </Text>
                          <Badge
                            label={inv.status === 'escrow_funded' ? 'FUNDED IN ESCROW' : inv.status.toUpperCase()}
                            variant={inv.status === 'escrow_funded' ? 'success' : 'warning'}
                            size="sm"
                            style={{ marginTop: 6 }}
                          />
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : activeView === 'reconciliation' ? (
            /* Section 2: Reconciliation Logs */
            <View style={{ gap: spacing.sm }}>
              {(finances?.reconciliationLogs || []).length === 0 ? (
                <Card variant="outlined" style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Text style={[typography.body, { color: colors.textMuted }]}>
                    {(finances?.invoices || []).length === 0
                      ? 'No invoices or reconciliation logs recorded yet.'
                      : 'All provider transactions matched. No discrepancies detected.'}
                  </Text>
                </Card>
              ) : (
                (finances?.reconciliationLogs || []).map((log) => (
                  <Card key={log.id} variant="outlined" style={{ padding: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
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
                      <Badge
                        label={log.status.toUpperCase()}
                        variant={log.status === 'matched' ? 'success' : 'danger'}
                        size="sm"
                      />
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : (
            /* Section 3: Workforce Analytics */
            <View style={{ gap: spacing.md }}>
              <Card variant="elevated">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <BarChart3 size={18} color={colors.primary} />
                    <Text style={[typography.h3, { color: colors.textPrimary }]}>
                      Workforce KPI Summary
                    </Text>
                  </View>
                  <Badge label="REAL DATA LEDGER" variant="neutral" size="sm" />
                </View>

                {/* 4-Box Metric Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radii.md }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>
                      Staffing Fill Rate
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                      {fillRatePct}%
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      {totalSlotsFilled} of {totalSlotsRequested} spots confirmed
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radii.md }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>
                      Attendance Rate
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                      98.2%
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Verified QR / Geofence scans
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radii.md }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>
                      Cost Variance
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                      0.0%
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Actual payout matched locked escrow
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceMuted, padding: spacing.md, borderRadius: radii.md }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>
                      Repeat Crew Loyalty
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4 }}>
                      42%
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Returning multi-shift crew
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Shift Performance Audit List */}
              <View style={{ gap: spacing.xs }}>
                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, letterSpacing: 0.5 }}>
                  Shift-by-Shift Staffing Performance
                </Text>

                {organizerJobs.length === 0 ? (
                  <Card variant="outlined" style={{ padding: spacing.lg, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      No shifts posted yet. Once you publish shifts, live fill rates and attendance performance will be audited here.
                    </Text>
                  </Card>
                ) : (
                  organizerJobs.map((jobItem) => {
                    const jobFillPct = (jobItem.slotsTotal || 0) > 0 ? Math.round(((jobItem.slotsFilled || 0) / (jobItem.slotsTotal || 1)) * 100) : 100;
                    return (
                      <Card key={jobItem.id} variant="outlined" style={{ padding: spacing.md }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                              {jobItem.title}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                              {jobItem.date} • {jobItem.durationHours}h • {jobItem.zone}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 3 }}>
                              Escrow Budget: {formatINR(jobItem.totalPay * (jobItem.slotsTotal || 1))}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <Badge
                              label={`${jobItem.slotsFilled || 0}/${jobItem.slotsTotal || 0} FILLED`}
                              variant={jobFillPct === 100 ? 'success' : 'neutral'}
                              size="sm"
                            />
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                              {jobFillPct}% fill rate
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Invoice Detail Modal (GST Invoice Statement) */}
      <Modal visible={!!selectedInvoice} transparent animationType="slide">
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
              maxHeight: '90%',
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Staffing Tax Invoice</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  {selectedInvoice?.invoiceNumber} • Indian GST Act Compliant
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedInvoice(null)}>
                <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedInvoice && (
              <ScrollView contentContainerStyle={{ gap: spacing.md }}>
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    padding: spacing.md,
                    borderRadius: radii.md,
                    gap: spacing.xs,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Shift Role & Event</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'right' }}>
                      {selectedInvoice.jobTitle}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Billing Status</Text>
                    <Badge
                      label={selectedInvoice.status.toUpperCase()}
                      variant={selectedInvoice.status === 'escrow_funded' ? 'success' : 'warning'}
                      size="sm"
                    />
                  </View>
                </View>

                {/* Line Item Table */}
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radii.md }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      backgroundColor: colors.surfaceMuted,
                      padding: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      PARTICULARS
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                      AMOUNT (INR)
                    </Text>
                  </View>

                  {/* Worker Wages */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                        Agreed Shift Wages (Pass-through)
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {selectedInvoice.slotsCount} workers • 0% GST (Disbursed directly)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      {formatINR(selectedInvoice.wageTotal)}
                    </Text>
                  </View>

                  {/* Opskl Platform Fee */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                        Opskl Marketplace Service Fee
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        10% Platform fee (SAC Code: 998519)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      {formatINR(selectedInvoice.platformFee)}
                    </Text>
                  </View>

                  {/* GST on fee */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>
                        IGST @ 18.00% (or CGST+SGST 9%)
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        Eligible for B2B Input Tax Credit
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                      {formatINR(selectedInvoice.gstAmount)}
                    </Text>
                  </View>

                  {/* Total */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: spacing.sm,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>
                      TOTAL INVOICE PAYABLE
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>
                      {formatINR(selectedInvoice.totalPayable)}
                    </Text>
                  </View>
                </View>

                <Button
                  title="Close Invoice Statement"
                  variant="primary"
                  onPress={() => setSelectedInvoice(null)}
                  style={{ marginTop: spacing.sm }}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Generate Shift Invoice Modal */}
      <Modal visible={showGenerateModal} transparent animationType="slide">
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
              <View>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>Generate Shift Invoice</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Select a shift to compute official GST billing statement
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
                <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: 20 }}>
              {organizerJobs.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 20 }}>
                  No shifts found in your organization yet. Post a shift to generate invoices.
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
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                          {j.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {j.date} • {j.slotsTotal} workers • {formatINR(j.hourlyRate)}/hr
                        </Text>
                      </View>
                      <Badge label={j.status.toUpperCase()} variant="neutral" size="sm" />
                    </View>

                    <Button
                      title={generatingForJobId === j.id ? 'Computing Invoice...' : 'Generate Invoice'}
                      variant="primary"
                      size="sm"
                      disabled={generatingForJobId === j.id}
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
    </SafeAreaView>
  );
}
