import { supabase } from './client';
import {
  WorkerEarningsSummary,
  OrganizerFinancesSummary,
  OrganizerInvoice,
  PaymentRecord,
  PaymentReconciliationLog,
} from '../types';
import { logger } from '../utils/logger';

/**
 * Fetch complete Worker Earnings Summary
 * Aggregates all 6 required earnings dimensions:
 * 1. Confirmed upcoming wages
 * 2. Completed shifts awaiting approval
 * 3. Approved wages awaiting payment
 * 4. Paid earnings
 * 5. Failed or delayed payments
 * 6. Disputed amounts
 */
export async function fetchWorkerEarningsSummary(
  workerId: string
): Promise<WorkerEarningsSummary> {
  logger.info('Fetching earnings summary for worker', { workerId });

  // 1. Fetch worker profile for default UPI ID
  const { data: profile } = await supabase
    .from('worker_profiles')
    .select('upi_id')
    .eq('id', workerId)
    .single();

  const defaultUpiId = profile?.upi_id || '';

  // 2. Fetch all bookings for worker to categorize lifecycle stages
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id,
      job_id,
      status,
      agreed_total_pay,
      confirmed_at,
      completed_at,
      jobs (
        id,
        title,
        date,
        start_time,
        end_time
      )
    `)
    .eq('worker_id', workerId);

  if (bookingsError) {
    logger.error('Failed to fetch worker bookings for earnings', bookingsError, { workerId });
  }

  // 3. Fetch all payment records for worker
  const { data: paymentRecords, error: paymentsError } = await supabase
    .from('payment_records')
    .select('*')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  if (paymentsError) {
    logger.error('Failed to fetch payment records for worker', paymentsError, { workerId });
  }

  let confirmedUpcomingWages = 0;
  let completedAwaitingApproval = 0;
  let approvedAwaitingPayment = 0;
  let paidEarnings = 0;
  let failedDelayedPayments = 0;
  let disputedAmounts = 0;

  const records: PaymentRecord[] = [];

  // Categorize bookings
  if (bookings && bookings.length > 0) {
    for (const b of bookings) {
      const pay = Number(b.agreed_total_pay) || 0;

      if (b.status === 'confirmed') {
        confirmedUpcomingWages += pay;
      } else if (b.status === 'checked_in' || b.status === 'checked_out' || b.status === 'completed_awaiting_review') {
        completedAwaitingApproval += pay;
      } else if (b.status === 'disputed') {
        disputedAmounts += pay;
      }
    }
  }

  // Categorize payment records
  if (paymentRecords && paymentRecords.length > 0) {
    for (const p of paymentRecords) {
      const net = Number(p.net_payout) || 0;

      if (p.status === 'settled') {
        paidEarnings += net;
      } else if (p.status === 'escrow_locked' || p.status === 'processing' || p.status === 'pending') {
        approvedAwaitingPayment += net;
      } else if (p.status === 'failed') {
        failedDelayedPayments += net;
      }

      records.push({
        id: p.id,
        bookingId: p.booking_id,
        jobId: p.job_id,
        workerId: p.worker_id,
        organizerId: p.organizer_id,
        amount: Number(p.amount) || net,
        platformFee: Number(p.platform_fee) || 0,
        netPayout: net,
        status: p.status,
        upiId: p.upi_id,
        utrReference: p.utr_reference || undefined,
        failureReason: p.failure_reason || undefined,
        retryCount: p.retry_count || 0,
        idempotencyKey: p.idempotency_key || undefined,
        providerPayoutId: p.provider_payout_id || undefined,
        isSandbox: p.is_sandbox ?? true,
        escrowLockedAt: p.escrow_locked_at || p.created_at,
        settledAt: p.settled_at || undefined,
        createdAt: p.created_at,
      });
    }
  }


  const totalEarnedAllTime = paidEarnings + approvedAwaitingPayment;

  return {
    confirmedUpcomingWages,
    completedAwaitingApproval,
    approvedAwaitingPayment,
    paidEarnings,
    failedDelayedPayments,
    disputedAmounts,
    totalEarnedAllTime,
    defaultUpiId,
    records,
  };
}

/**
 * Fetch Organizer Finances Summary
 * Strictly separates worker wages, platform fees, and 18% GST
 */
export async function fetchOrganizerFinancesSummary(
  organizerId: string
): Promise<OrganizerFinancesSummary> {
  logger.info('Fetching finances summary for organizer', { organizerId });

  // 1. Fetch invoices
  const { data: invoiceRows, error: invoiceError } = await supabase
    .from('organizer_invoices')
    .select(`
      *,
      jobs (
        id,
        title,
        slots_filled,
        slots_total
      )
    `)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (invoiceError) {
    logger.error('Failed to fetch organizer invoices', invoiceError, { organizerId });
  }

  // 2. Fetch reconciliation logs scoped to organizer's invoices
  const invoiceNumbers = (invoiceRows || []).map((inv: any) => inv.invoice_number).filter(Boolean);

  let logs: any[] = [];
  if (invoiceNumbers.length > 0) {
    const { data: logData, error: logsError } = await supabase
      .from('payment_reconciliation_logs')
      .select('*')
      .in('reference_id', invoiceNumbers)
      .order('created_at', { ascending: false })
      .limit(20);

    if (logsError) {
      logger.error('Failed to fetch reconciliation logs for organizer invoices', logsError, { organizerId });
    } else {
      logs = logData || [];
    }
  }

  let workerWageTotals = 0;
  let opskilServiceFees = 0;
  let applicableTaxes = 0;
  let settledAmount = 0;
  let outstandingEscrowDue = 0;

  const invoices: OrganizerInvoice[] = [];

  if (invoiceRows && invoiceRows.length > 0) {
    for (const inv of invoiceRows) {
      const wages = Number(inv.wage_total) || 0;
      const fee = Number(inv.platform_fee) || 0;
      const gst = Number(inv.gst_amount) || 0;
      const total = Number(inv.total_payable) || 0;

      workerWageTotals += wages;
      opskilServiceFees += fee;
      applicableTaxes += gst;

      if (inv.status === 'settled' || inv.status === 'escrow_funded') {
        settledAmount += total;
      } else if (inv.status === 'pending' || inv.status === 'overdue') {
        outstandingEscrowDue += total;
      }

      invoices.push({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        jobId: inv.job_id,
        organizerId: inv.organizer_id,
        wageTotal: wages,
        platformFee: fee,
        gstRate: Number(inv.gst_rate) || 18.0,
        gstAmount: gst,
        totalPayable: total,
        status: inv.status,
        paymentMethod: inv.payment_method || 'upi',
        paymentProvider: inv.payment_provider || 'razorpay',
        providerOrderId: inv.provider_order_id || undefined,
        providerPaymentId: inv.provider_payment_id || undefined,
        dueDate: inv.due_date,
        paidAt: inv.paid_at || undefined,
        isSandbox: inv.is_sandbox ?? true,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
        jobTitle: inv.jobs?.title || 'Event Shift',
        slotsCount: inv.jobs?.slots_filled || inv.jobs?.slots_total || 1,
      });
    }
  }


  const reconciliationLogs: PaymentReconciliationLog[] = (logs || []).map((l: any) => ({
    id: l.id,
    reconciliationType: l.reconciliation_type,
    referenceId: l.reference_id,
    status: l.status,
    expectedAmount: Number(l.expected_amount) || 0,
    recordedAmount: Number(l.recorded_amount) || 0,
    discrepancyAmount: Number(l.discrepancy_amount) || 0,
    notes: l.notes || undefined,
    actorId: l.actor_id || undefined,
    isSandbox: l.is_sandbox ?? true,
    createdAt: l.created_at,
  }));

  const totalPayableAllTime = workerWageTotals + opskilServiceFees + applicableTaxes;

  return {
    workerWageTotals,
    opskilServiceFees,
    applicableTaxes,
    totalPayableAllTime,
    settledAmount,
    outstandingEscrowDue,
    invoices,
    reconciliationLogs,
  };
}

/**
 * Generate or Update Authoritative Shift Invoice
 */
export async function generateJobInvoiceSafe(
  jobId: string,
  organizerId: string
): Promise<{ success: boolean; invoiceId?: string; invoiceNumber?: string; totalPayable?: number; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('generate_job_invoice_safe', {
      p_job_id: jobId,
      p_organizer_id: organizerId,
    });

    if (rpcError) {
      logger.error('RPC generate_job_invoice_safe failed', rpcError, { jobId, organizerId });
      return { success: false, error: rpcError.message };
    }

    if (!rpcData) {
      return { success: false, error: 'Empty response returned from invoice generator' };
    }

    return {
      success: rpcData.success,
      invoiceId: rpcData.invoice_id,
      invoiceNumber: rpcData.invoice_number,
      totalPayable: rpcData.total_payable,
      error: rpcData.error,
    };
  } catch (err: any) {
    logger.error('Failed to generate job invoice', err, { jobId, organizerId });
    return { success: false, error: err.message };
  }
}

/**
 * Idempotent Webhook Event Processor
 */
export async function processPaymentWebhookSafe(
  provider: string,
  eventId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_payment_webhook_safe', {
      p_provider: provider,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
    });

    if (rpcError) {
      logger.error('Payment webhook RPC failure — failing closed', rpcError, {
        provider,
        eventId,
        eventType,
      });
      return {
        success: false,
        error: rpcError.message || 'Webhook processing failed in database RPC',
      };
    }

    if (rpcData) {
      return {
        success: Boolean(rpcData.success),
        duplicate: Boolean(rpcData.duplicate),
        error: rpcData.error,
      };
    }

    return {
      success: false,
      error: 'Empty response returned from payment webhook processor',
    };
  } catch (err: any) {
    logger.error('Payment webhook processing exception', err, { provider, eventId });
    return { success: false, error: err.message || 'Unexpected webhook error' };
  }
}

/**
 * Initiate Safe Worker Payout (Idempotent)
 */
export async function initiateWorkerPayoutSafe(
  bookingId: string,
  upiId: string,
  idempotencyKey?: string
): Promise<{ success: boolean; paymentId?: string; status?: string; utr?: string; error?: string }> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('initiate_worker_payout_safe', {
      p_booking_id: bookingId,
      p_upi_id: upiId,
      p_idempotency_key: idempotencyKey ?? null,
    });

    if (rpcError) {
      logger.error('RPC error in initiate_worker_payout_safe', rpcError);
      return { success: false, error: rpcError.message };
    }

    if (rpcData) {
      return {
        success: rpcData.success,
        paymentId: rpcData.payment_id,
        status: rpcData.status || 'processing',
        utr: rpcData.utr,
        error: rpcData.error,
      };
    }

    return { success: false, error: 'No response data from payout transaction.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
