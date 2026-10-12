/**
 * OPSKL Payment Provider Abstraction
 * Supports Indian payment gateways (Razorpay Route, Cashfree Payouts, UPI Autopay)
 * and Sandbox testing environment.
 */

export interface CreateOrderParams {
  jobId: string;
  organizerId: string;
  amountInr: number; // in INR
  currency?: 'INR';
  receiptInvoiceNumber: string;
  notes?: Record<string, string>;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  amountInr: number;
  currency: string;
  provider: string;
  isSandbox: boolean;
  error?: string;
}

export interface DisbursePayoutParams {
  paymentRecordId: string;
  workerId: string;
  upiId: string;
  amountInr: number; // in INR
  narration: string; // e.g. "Opskl Shift Payout - Auto Expo"
  idempotencyKey: string;
}

export interface PayoutResult {
  success: boolean;
  payoutId?: string;
  utrReference?: string;
  status: 'processing' | 'settled' | 'failed' | 'reversed';
  failureReason?: string;
  isSandbox: boolean;
  error?: string;
}

export interface PayoutStatusResult {
  payoutId: string;
  status: 'processing' | 'settled' | 'failed' | 'reversed';
  utrReference?: string;
  failureReason?: string;
  settledAt?: string;
}

export interface WebhookVerificationParams {
  rawBody: string;
  signature: string;
  secret: string;
}

export interface RefundParams {
  paymentId: string;
  amountInr: number;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status: 'processed' | 'pending' | 'failed';
  error?: string;
}

export interface PaymentProvider {
  readonly providerName: string;
  readonly isSandbox: boolean;

  createEscrowOrder(params: CreateOrderParams): Promise<OrderResult>;
  verifyWebhookSignature(params: WebhookVerificationParams): boolean;
  disburseWorkerPayout(params: DisbursePayoutParams): Promise<PayoutResult>;
  getPayoutStatus(payoutId: string): Promise<PayoutStatusResult>;
  refundEscrow(params: RefundParams): Promise<RefundResult>;
}
