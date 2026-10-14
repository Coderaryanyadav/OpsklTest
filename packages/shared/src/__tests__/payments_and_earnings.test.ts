import {
  calculateJobFinancials,
  calculateHoursAdjustment,
  isValidIndianUpiId,
  generateHmacSha256,
  verifyHmacSha256,
  generateIdempotencyKey,
  SandboxPaymentProvider,
  processPaymentWebhookSafe,
  fetchWorkerEarningsSummary,
  fetchOrganizerFinancesSummary,
  generateJobInvoiceSafe,
} from '../index';

// Mock Supabase client
jest.mock('../supabase/client', () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc, __mockFrom } = require('../supabase/client');

describe('Phase 6 — Opskl Payments, Earnings & Financial Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authoritative Server-Side Financial Calculations', () => {
    test('guarantees 100% of agreed worker wages with 0 deduction from worker pay', () => {
      // 10 workers @ ₹1,500/day
      const breakdown = calculateJobFinancials(10, 1500, 10, 18);

      expect(breakdown.headcount).toBe(10);
      expect(breakdown.wagePerWorker).toBe(1500);
      // Total worker wages = 10 * 1500 = ₹15,000 (Pass-through)
      expect(breakdown.totalWorkerWages).toBe(15000);
      // Opskl Platform fee = 10% of ₹15,000 = ₹1,500
      expect(breakdown.platformFeeAmount).toBe(1500);
      // GST is 18% strictly on the platform fee = 18% of ₹1,500 = ₹270
      expect(breakdown.gstAmount).toBe(270);
      // Total invoice payable by organizer = 15000 + 1500 + 270 = ₹16,770
      expect(breakdown.totalPayableByOrganizer).toBe(16770);
      expect(breakdown.effectiveCostPerWorker).toBe(1677);
    });

    test('handles single worker minimum shifts gracefully', () => {
      const breakdown = calculateJobFinancials(1, 1000, 10, 18);
      expect(breakdown.totalWorkerWages).toBe(1000);
      expect(breakdown.platformFeeAmount).toBe(100);
      expect(breakdown.gstAmount).toBe(18);
      expect(breakdown.totalPayableByOrganizer).toBe(1118);
    });

    test('handles overtime hours adjustments accurately', () => {
      // Scheduled 8 hours for ₹1,600 (base rate ₹200/hr)
      // Worked 10 hours (2 hours approved overtime @ 1.5x = ₹300/hr)
      const res = calculateHoursAdjustment(8, 10, 1600, 1.5);
      expect(res.regularHours).toBe(8);
      expect(res.actualHours).toBe(10);
      expect(res.overtimeHours).toBe(2);
      expect(res.baseHourlyRate).toBe(200);
      expect(res.overtimePay).toBe(600); // 2 * 300
      expect(res.totalAdjustedPay).toBe(2200); // 1600 + 600
    });

    test('validates and rejects Indian UPI ID formats accurately', () => {
      expect(isValidIndianUpiId('aryan@okhdfcbank')).toBe(true);
      expect(isValidIndianUpiId('9820098200@paytm')).toBe(true);
      expect(isValidIndianUpiId('rohan.sharma@icici')).toBe(true);
      expect(isValidIndianUpiId('crew_lead-01@axl')).toBe(true);

      expect(isValidIndianUpiId('')).toBe(false);
      expect(isValidIndianUpiId('invalid-handle')).toBe(false);
      expect(isValidIndianUpiId('user@')).toBe(false);
      expect(isValidIndianUpiId('@hdfc')).toBe(false);
      expect(isValidIndianUpiId('user@@axis')).toBe(false);
    });
  });

  describe('HMAC-SHA256 Webhook Signatures & Idempotency', () => {
    const secret = 'test_webhook_secret_key_99';
    const payload = JSON.stringify({ event: 'payout.processed', id: 'evt_12345' });

    test('generates valid HMAC signature that verifies correctly', () => {
      const signature = generateHmacSha256(payload, secret);
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(10);

      const isValid = verifyHmacSha256(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    test('rejects tampered payload or incorrect secret', () => {
      const signature = generateHmacSha256(payload, secret);
      const tamperedPayload = JSON.stringify({ event: 'payout.processed', id: 'evt_tampered' });

      expect(verifyHmacSha256(tamperedPayload, signature, secret)).toBe(false);
      expect(verifyHmacSha256(payload, signature, 'wrong_secret')).toBe(false);
    });

    test('generates unique idempotency keys', () => {
      const key1 = generateIdempotencyKey('payout');
      const key2 = generateIdempotencyKey('payout');
      expect(key1).toContain('payout_');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Sandbox Payment Provider Lifecycle', () => {
    let provider: SandboxPaymentProvider;

    beforeEach(() => {
      provider = new SandboxPaymentProvider({ webhookSecret: 'test_secret' });
    });

    test('creates sandbox escrow order successfully', async () => {
      const order = await provider.createEscrowOrder({
        jobId: 'job-101',
        organizerId: 'org-202',
        amountInr: 16770,
        receiptInvoiceNumber: 'INV-202610-001',
      });

      expect(order.success).toBe(true);
      expect(order.orderId).toContain('order_sbx_');
      expect(order.isSandbox).toBe(true);
    });

    test('rejects order with invalid or non-positive amount', async () => {
      const order = await provider.createEscrowOrder({
        jobId: 'job-101',
        organizerId: 'org-202',
        amountInr: -500,
        receiptInvoiceNumber: 'INV-202610-001',
      });

      expect(order.success).toBe(false);
      expect(order.error).toContain('greater than zero');
    });

    test('disburses worker payout with valid 12-digit Indian UTR', async () => {
      const res = await provider.disburseWorkerPayout({
        paymentRecordId: 'rec-1',
        workerId: 'worker-1',
        upiId: 'worker@okhdfcbank',
        amountInr: 1500,
        narration: 'Opskl Auto Expo Payout',
        idempotencyKey: 'idemp_001',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('settled');
      expect(res.utrReference).toMatch(/^42\d{10}$/); // 12-digit numeric
    });

    test('rejects payout disbursement to invalid UPI handle', async () => {
      const res = await provider.disburseWorkerPayout({
        paymentRecordId: 'rec-1',
        workerId: 'worker-1',
        upiId: 'malformed_upi_handle',
        amountInr: 1500,
        narration: 'Opskl Auto Expo Payout',
        idempotencyKey: 'idemp_002',
      });

      expect(res.success).toBe(false);
      expect(res.failureReason).toBe('INVALID_UPI_HANDLE');
    });

    test('simulates bank failure and retry resilience', async () => {
      provider.setForceFailPayout(true, 'NPCI_BENEFICIARY_BANK_TIMEOUT');

      const res = await provider.disburseWorkerPayout({
        paymentRecordId: 'rec-1',
        workerId: 'worker-1',
        upiId: 'worker@okhdfcbank',
        amountInr: 1500,
        narration: 'Opskl Auto Expo Payout',
        idempotencyKey: 'idemp_003',
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.failureReason).toBe('NPCI_BENEFICIARY_BANK_TIMEOUT');
    });
  });

  describe('Idempotent Webhook Event Reconciliation', () => {
    test('processes new webhook event safely', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, duplicate: false },
        error: null,
      });

      const res = await processPaymentWebhookSafe('sandbox', 'evt_991', 'payout.processed', {
        amount: 1500,
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(false);
    });

    test('detects duplicate webhook event and suppresses side-effects', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true, duplicate: true },
        error: null,
      });

      const res = await processPaymentWebhookSafe('sandbox', 'evt_991', 'payout.processed', {
        amount: 1500,
      });

      expect(res.success).toBe(true);
      expect(res.duplicate).toBe(true);
    });
  });

  describe('Worker Earnings & Organizer Financial Aggregation', () => {
    test('fetches worker earnings summary and aggregates dimensions from real persisted rows', async () => {
      __mockFrom.mockImplementation((table: string) => {
        if (table === 'worker_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { upi_id: 'aryan@okhdfcbank' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'bookings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  { id: 'b-1', job_id: 'j-1', status: 'confirmed', agreed_total_pay: 1650 },
                  { id: 'b-2', job_id: 'j-2', status: 'checked_in', agreed_total_pay: 1500 },
                  { id: 'b-3', job_id: 'j-3', status: 'disputed', agreed_total_pay: 800 },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'payment_records') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'pay-1',
                      booking_id: 'b-1',
                      job_id: 'j-1',
                      worker_id: 'worker-101',
                      organizer_id: 'org-1',
                      amount: 1650,
                      platform_fee: 0,
                      net_payout: 1650,
                      status: 'settled',
                      upi_id: 'aryan@okhdfcbank',
                      created_at: new Date().toISOString(),
                    },
                    {
                      id: 'pay-2',
                      booking_id: 'b-2',
                      job_id: 'j-2',
                      worker_id: 'worker-101',
                      organizer_id: 'org-1',
                      amount: 1500,
                      platform_fee: 0,
                      net_payout: 1500,
                      status: 'processing',
                      upi_id: 'aryan@okhdfcbank',
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const summary = await fetchWorkerEarningsSummary('worker-101');
      expect(summary.defaultUpiId).toBe('aryan@okhdfcbank');
      expect(summary.confirmedUpcomingWages).toBe(1650);
      expect(summary.completedAwaitingApproval).toBe(1500);
      expect(summary.disputedAmounts).toBe(800);
      expect(summary.paidEarnings).toBe(1650);
      expect(summary.approvedAwaitingPayment).toBe(1500);
      expect(summary.totalEarnedAllTime).toBe(3150);
      expect(summary.records.length).toBe(2);
    });

    test('returns clean zero balances and empty array for a brand new worker with 0 records', async () => {
      __mockFrom.mockImplementation((table: string) => {
        if (table === 'worker_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { upi_id: '' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'bookings') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'payment_records') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const summary = await fetchWorkerEarningsSummary('new-worker-0');
      expect(summary.paidEarnings).toBe(0);
      expect(summary.confirmedUpcomingWages).toBe(0);
      expect(summary.completedAwaitingApproval).toBe(0);
      expect(summary.approvedAwaitingPayment).toBe(0);
      expect(summary.failedDelayedPayments).toBe(0);
      expect(summary.disputedAmounts).toBe(0);
      expect(summary.totalEarnedAllTime).toBe(0);
      expect(summary.records).toEqual([]);
    });

    test('fetches organizer finances summary and isolates worker wages from platform fees & GST', async () => {
      __mockFrom.mockImplementation((table: string) => {
        if (table === 'organizer_invoices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'inv-1',
                      invoice_number: 'INV-202610-001',
                      job_id: 'job-1',
                      organizer_id: 'org-101',
                      wage_total: 15000,
                      platform_fee: 1500,
                      gst_rate: 18.0,
                      gst_amount: 270,
                      total_payable: 16770,
                      status: 'escrow_funded',
                      payment_method: 'upi',
                      due_date: '2026-10-20T18:00:00Z',
                      paid_at: '2026-10-15T12:00:00Z',
                      is_sandbox: true,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      jobs: { title: 'Conference Usher Crew', slots_filled: 10, slots_total: 10 },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'payment_reconciliation_logs') {
          const orderMock = {
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue(orderMock),
              }),
              order: jest.fn().mockReturnValue(orderMock),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const finances = await fetchOrganizerFinancesSummary('org-101');
      expect(finances.workerWageTotals).toBe(15000);
      expect(finances.opskilServiceFees).toBe(1500);
      expect(finances.applicableTaxes).toBe(270);
      expect(finances.totalPayableAllTime).toBe(16770);
      expect(finances.settledAmount).toBe(16770);
      expect(finances.invoices.length).toBe(1);
    });

    test('returns clean zero financial metrics for a brand new organizer with 0 invoices', async () => {
      __mockFrom.mockImplementation((table: string) => {
        if (table === 'organizer_invoices') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'payment_reconciliation_logs') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      });

      const finances = await fetchOrganizerFinancesSummary('new-org-0');
      expect(finances.workerWageTotals).toBe(0);
      expect(finances.opskilServiceFees).toBe(0);
      expect(finances.applicableTaxes).toBe(0);
      expect(finances.totalPayableAllTime).toBe(0);
      expect(finances.settledAmount).toBe(0);
      expect(finances.outstandingEscrowDue).toBe(0);
      expect(finances.invoices).toEqual([]);
      expect(finances.reconciliationLogs).toEqual([]);
    });
  });

  describe('Authoritative Job Invoice Generation', () => {
    test('returns generated invoice details when RPC succeeds', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          invoice_id: 'inv-uuid-1',
          invoice_number: 'INV-202610-12345',
          total_payable: 16770,
        },
        error: null,
      });

      const res = await generateJobInvoiceSafe('job-1', 'org-1');
      expect(res.success).toBe(true);
      expect(res.invoiceNumber).toBe('INV-202610-12345');
      expect(res.totalPayable).toBe(16770);
    });

    test('fails closed on RPC error and does not produce hardcoded fallback invoices', async () => {
      __mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database constraint violation or unauthorized caller' },
      });

      const res = await generateJobInvoiceSafe('job-1', 'org-1');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Database constraint violation');
      expect(res.invoiceId).toBeUndefined();
      expect(res.invoiceNumber).toBeUndefined();
    });
  });
});
