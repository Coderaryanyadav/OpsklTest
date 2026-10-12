import {
  calculateJobFinancials,
  calculateHoursAdjustment,
  isValidIndianUpiId,
  formatINR,
  formatISTDate,
  formatTimeRange,
  formatDistance,
} from '../index';

describe('Phase 9 — Premium Mobile Experience & Financial Usability', () => {
  describe('Financial Transparency & Zero Commission Invariants', () => {
    test('enforces 100% worker wage pass-through with zero commission deductions', () => {
      const headcount = 5;
      const wagePerWorker = 1850; // ₹1,850 for 9-hour conference shift
      const breakdown = calculateJobFinancials(headcount, wagePerWorker);

      // Total wage paid to workers
      expect(breakdown.totalWorkerWages).toBe(9250);
      expect(breakdown.wagePerWorker).toBe(1850);
      expect(breakdown.headcount).toBe(5);

      // Platform fee is 10% charged strictly to organizer
      expect(breakdown.platformFeePercent).toBe(10);
      expect(breakdown.platformFeeAmount).toBe(925);

      // GST (18%) is levied strictly on the platform fee, never on worker wages
      expect(breakdown.gstRatePercent).toBe(18);
      expect(breakdown.gstAmount).toBe(166.5);

      // Total organizer invoice
      expect(breakdown.totalPayableByOrganizer).toBe(10341.5);
      expect(breakdown.effectiveCostPerWorker).toBe(2068.3);
    });

    test('calculates correct overtime compensation with statutory 1.5x multiplier', () => {
      const regularHours = 9;
      const actualHours = 11; // 2 hours overtime
      const agreedTotalPay = 1800; // Base rate: ₹200/hr

      const result = calculateHoursAdjustment(regularHours, actualHours, agreedTotalPay);
      expect(result.regularHours).toBe(9);
      expect(result.actualHours).toBe(11);
      expect(result.overtimeHours).toBe(2);
      expect(result.baseHourlyRate).toBe(200);
      expect(result.basePay).toBe(1800);
      // Overtime rate: 200 * 1.5 = ₹300/hr -> 2h = ₹600
      expect(result.overtimePay).toBe(600);
      expect(result.totalAdjustedPay).toBe(2400);
    });

    test('preserves full agreed shift pay when shift ends early at organizer discretion', () => {
      const regularHours = 9;
      const actualHours = 7.5; // Released 1.5h early
      const agreedTotalPay = 1800;

      const result = calculateHoursAdjustment(regularHours, actualHours, agreedTotalPay);
      expect(result.actualHours).toBe(7.5);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalAdjustedPay).toBe(1800);
    });
  });

  describe('UPI Handle Validation for Instant Direct Settlement', () => {
    test('accepts valid Indian bank UPI handles across top PSPs', () => {
      expect(isValidIndianUpiId('aryan@okhdfcbank')).toBe(true);
      expect(isValidIndianUpiId('9820098200@paytm')).toBe(true);
      expect(isValidIndianUpiId('neha.kulkarni@icici')).toBe(true);
      expect(isValidIndianUpiId('events.apex@ybl')).toBe(true);
      expect(isValidIndianUpiId('vikram-joshi@axl')).toBe(true);
    });

    test('rejects invalid UPI handles', () => {
      expect(isValidIndianUpiId('')).toBe(false);
      expect(isValidIndianUpiId('invalidhandle')).toBe(false);
      expect(isValidIndianUpiId('@okhdfcbank')).toBe(false);
      expect(isValidIndianUpiId('name@')).toBe(false);
      expect(isValidIndianUpiId('name@@bank')).toBe(false);
    });
  });

  describe('High-Clarity Localized Formatters', () => {
    test('formats Indian Rupee currency with standard Indian numbering system', () => {
      expect(formatINR(0)).toBe('₹0');
      expect(formatINR(850)).toBe('₹850');
      expect(formatINR(12450)).toBe('₹12,450');
      expect(formatINR(1250000)).toBe('₹12,50,000');
    });

    test('formats distance in kilometers with clean decimal precision', () => {
      expect(formatDistance(null)).toBe('Distance unavailable');
      expect(formatDistance(0.4)).toBe('Under 500m away');
      expect(formatDistance(4.25)).toBe('4.3 km away');
      expect(formatDistance(18.9)).toBe('18.9 km away');
    });

    test('formats shift time range in 12-hour AM/PM format', () => {
      const formatted = formatTimeRange('08:30', '17:30');
      expect(formatted).toContain('8:30');
      expect(formatted).toContain('5:30');
    });

    test('formats date in IST timezone cleanly', () => {
      const formatted = formatISTDate('2026-10-15');
      expect(formatted).toContain('Oct');
      expect(formatted).toContain('2026');
    });
  });
});
