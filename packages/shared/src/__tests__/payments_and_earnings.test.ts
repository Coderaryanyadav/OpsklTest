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
    test('fetches worker earnings summary and populates all 6 dimensions', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { upi_id: 'aryan@okhdfcbank' }, error: null }),
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const summary = await fetchWorkerEarningsSummary('worker-101');
      expect(summary.defaultUpiId).toBe('aryan@okhdfcbank');
      expect(summary.paidEarnings).toBeGreaterThanOrEqual(0);
      expect(summary.confirmedUpcomingWages).toBeGreaterThanOrEqual(0);
      expect(summary.completedAwaitingApproval).toBeGreaterThanOrEqual(0);
      expect(summary.approvedAwaitingPayment).toBeGreaterThanOrEqual(0);
      expect(summary.failedDelayedPayments).toBeGreaterThanOrEqual(0);
      expect(summary.records.length).toBeGreaterThan(0);
    });

    test('fetches organizer finances summary and isolates worker wages from platform fees & GST', async () => {
      __mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const finances = await fetchOrganizerFinancesSummary('org-101');
      expect(finances.workerWageTotals).toBeGreaterThan(0);
      expect(finances.opskilServiceFees).toBeGreaterThan(0);
      expect(finances.applicableTaxes).toBeGreaterThan(0);
      expect(finances.totalPayableAllTime).toBe(
        finances.workerWageTotals + finances.opskilServiceFees + finances.applicableTaxes
      );
      expect(finances.invoices.length).toBeGreaterThan(0);
    });
  });
});
