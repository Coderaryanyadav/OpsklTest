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
  OrganizerFinancesSummary,
  OrganizerInvoice,
  OrganizerProfile,
} from '@opskil/shared';

import { useAuth } from '@opskil/design-system';

type ActiveView = 'invoices' | 'reconciliation';

export default function OrganizerFinancesScreen() {
  const { colors, spacing, radii, typography } = useOpsklTheme();
  const { session } = useAuth();

  const [finances, setFinances] = useState<OrganizerFinancesSummary | null>(null);
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('invoices');

  const [selectedInvoice, setSelectedInvoice] = useState<OrganizerInvoice | null>(null);

  const organizerId = session?.user?.id;

  const loadData = useCallback(async () => {
    if (!organizerId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [data, profile] = await Promise.all([
        fetchOrganizerFinancesSummary(organizerId),
        fetchOrganizerProfile(organizerId),
      ]);
      setFinances(data);
      setOrganizerProfile(profile);
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
          Transparent staffing billing • GST compliant statements
        </Text>
      </View>

      {loading ? (
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
          {/* Executive Overview Grid */}
          <Card
            variant="elevated"
            style={{
              backgroundColor: colors.primary,
              borderColor: colors.primaryHover,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Total Staffing Spend (All-time)
                </Text>
                <WageText style={{ color: '#FFFFFF', fontSize: 32, lineHeight: 38, marginTop: 4 }}>
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
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                borderRadius: radii.md,
                padding: spacing.md,
                marginTop: spacing.md,
                gap: spacing.xs,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                  Total Settled in Escrow:
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                  {formatINR(finances?.settledAmount || 0)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                  Outstanding Escrow Due:
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: (finances?.outstandingEscrowDue || 0) > 0 ? '#FEF08A' : '#FFFFFF',
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

          {/* Toggle between Invoices and Reconciliation */}
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
                  fontSize: 13,
                  fontWeight: '700',
                  color: activeView === 'invoices' ? colors.primary : colors.textSecondary,
                }}
              >
                Invoices & Statements ({finances?.invoices.length || 0})
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
                  fontSize: 13,
                  fontWeight: '700',
                  color: activeView === 'reconciliation' ? colors.primary : colors.textSecondary,
                }}
              >
                Audit Reconciliation
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section 1: Invoices */}
          {activeView === 'invoices' ? (
            <View style={{ gap: spacing.sm }}>
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
          ) : (
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
    </SafeAreaView>
  );
}
