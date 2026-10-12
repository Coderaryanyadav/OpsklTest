/**
 * OPSKL Authoritative Server-side Financial Calculations
 * 
 * Rules:
 * 1. Worker wages are SACROSANCT: 100% of agreed wage is disbursed to the worker.
 *    Opskl never takes a commission cut from the worker's agreed daily wage.
 * 2. Opskl Platform Fee (10% default) is charged to the Event Organizer.
 * 3. Indian GST (18%) is levied STRICTLY on the Opskl Platform Fee (Intermediary SaaS/service fee),
 *    never on the pass-through worker wage component.
 * 4. All monetary figures are rounded to 2 decimal places in Indian Rupees (INR).
 */

export interface FinancialBreakdown {
  headcount: number;
  wagePerWorker: number;
  totalWorkerWages: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  gstRatePercent: number;
  gstAmount: number;
  totalPayableByOrganizer: number;
  effectiveCostPerWorker: number;
}

export function calculateJobFinancials(
  headcount: number,
  wagePerWorker: number,
  platformFeePercent: number = 10,
  gstRatePercent: number = 18
): FinancialBreakdown {
  const safeHeadcount = Math.max(1, Math.floor(headcount));
  const safeWage = Math.max(0, wagePerWorker);

  // 1. Worker wage total (100% to workers)
  const totalWorkerWages = Math.round(safeHeadcount * safeWage * 100) / 100;

  // 2. Marketplace service fee (charged to organizer)
  const platformFeeAmount = Math.round(totalWorkerWages * (platformFeePercent / 100) * 100) / 100;

  // 3. Indian GST (18% on platform fee only)
  const gstAmount = Math.round(platformFeeAmount * (gstRatePercent / 100) * 100) / 100;

  // 4. Total invoice payable by organizer
  const totalPayableByOrganizer = Math.round((totalWorkerWages + platformFeeAmount + gstAmount) * 100) / 100;

  const effectiveCostPerWorker = Math.round((totalPayableByOrganizer / safeHeadcount) * 100) / 100;

  return {
    headcount: safeHeadcount,
    wagePerWorker: safeWage,
    totalWorkerWages,
    platformFeePercent,
    platformFeeAmount,
    gstRatePercent,
    gstAmount,
    totalPayableByOrganizer,
    effectiveCostPerWorker,
  };
}

export interface HoursAdjustmentResult {
  regularHours: number;
  actualHours: number;
  overtimeHours: number;
  baseHourlyRate: number;
  basePay: number;
  overtimePay: number;
  totalAdjustedPay: number;
}

export function calculateHoursAdjustment(
  regularHours: number,
  actualHours: number,
  agreedTotalPay: number,
  overtimeMultiplier: number = 1.5
): HoursAdjustmentResult {
  const baseHours = Math.max(1, regularHours);
  const worked = Math.max(0, actualHours);
  const baseHourlyRate = Math.round((agreedTotalPay / baseHours) * 100) / 100;

  if (worked <= baseHours) {
    // Standard shift or minor early dismissal (full agreed shift pay preserved if dismissed by organizer)
    return {
      regularHours: baseHours,
      actualHours: worked,
      overtimeHours: 0,
      baseHourlyRate,
      basePay: agreedTotalPay,
      overtimePay: 0,
      totalAdjustedPay: agreedTotalPay,
    };
  }

  // Approved overtime
  const overtimeHours = Math.round((worked - baseHours) * 100) / 100;
  const overtimeRate = baseHourlyRate * overtimeMultiplier;
  const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
  const totalAdjustedPay = Math.round((agreedTotalPay + overtimePay) * 100) / 100;

  return {
    regularHours: baseHours,
    actualHours: worked,
    overtimeHours,
    baseHourlyRate,
    basePay: agreedTotalPay,
    overtimePay,
    totalAdjustedPay,
  };
}

/**
 * Validates Indian UPI ID (VPA) handle format
 * Format: username@bank / mobile@upi (e.g. aryan@okhdfcbank, 9876543210@paytm)
 */
export function isValidIndianUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upiId.trim());
}
