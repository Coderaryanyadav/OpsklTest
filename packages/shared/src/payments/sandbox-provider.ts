import {
  PaymentProvider,
  CreateOrderParams,
  OrderResult,
  DisbursePayoutParams,
  PayoutResult,
  PayoutStatusResult,
  WebhookVerificationParams,
  RefundParams,
  RefundResult,
} from './provider.interface';
import { generateHmacSha256, verifyHmacSha256 } from './crypto-utils';
import { isValidIndianUpiId } from './calculator';

export interface SandboxProviderConfig {
  webhookSecret?: string;
  forceFailPayout?: boolean;
  forcedFailureReason?: string;
}

export class SandboxPaymentProvider implements PaymentProvider {
  public readonly providerName = 'sandbox';
  public readonly isSandbox = true;

  private webhookSecret: string;
  private forceFailPayout: boolean;
  private forcedFailureReason?: string;

  constructor(config: SandboxProviderConfig = {}) {
    this.webhookSecret = config.webhookSecret || 'opskil_sandbox_webhook_secret_2026';
    this.forceFailPayout = !!config.forceFailPayout;
    this.forcedFailureReason = config.forcedFailureReason;
  }

  public setForceFailPayout(shouldFail: boolean, reason?: string) {
    this.forceFailPayout = shouldFail;
    this.forcedFailureReason = reason;
  }

  public async createEscrowOrder(params: CreateOrderParams): Promise<OrderResult> {
    if (params.amountInr <= 0) {
      return {
        success: false,
        amountInr: params.amountInr,
        currency: 'INR',
        provider: this.providerName,
        isSandbox: true,
        error: 'Order amount must be greater than zero INR',
      };
    }

    const orderId = `order_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      success: true,
      orderId,
      amountInr: params.amountInr,
      currency: 'INR',
      provider: this.providerName,
      isSandbox: true,
    };
  }

  public verifyWebhookSignature(params: WebhookVerificationParams): boolean {
    const secret = params.secret || this.webhookSecret;
    return verifyHmacSha256(params.rawBody, params.signature, secret);
  }

  public async disburseWorkerPayout(params: DisbursePayoutParams): Promise<PayoutResult> {
    // 1. Enforce strict UPI format validation
    if (!isValidIndianUpiId(params.upiId)) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'INVALID_UPI_HANDLE',
        isSandbox: true,
        error: `Invalid UPI handle "${params.upiId}". Must follow format username@bank.`,
      };
    }

    if (params.amountInr <= 0) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'INVALID_AMOUNT',
        isSandbox: true,
        error: 'Payout amount must be greater than zero INR',
      };
    }

    // 2. Simulated failure scenario (for testing resilience & retries)
    if (this.forceFailPayout) {
      return {
        success: false,
        payoutId: `pout_sbx_fail_${Date.now()}`,
        status: 'failed',
        failureReason: this.forcedFailureReason || 'NPCI_BENEFICIARY_BANK_OFFLINE',
        isSandbox: true,
        error: this.forcedFailureReason || 'NPCI Beneficiary bank offline. Retry scheduled.',
      };
    }

    // 3. Simulated success with Indian 12-digit UTR
    const payoutId = `pout_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const utrReference = `42${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    return {
      success: true,
      payoutId,
      utrReference,
      status: 'settled',
      isSandbox: true,
    };
  }

  public async getPayoutStatus(payoutId: string): Promise<PayoutStatusResult> {
    if (payoutId.includes('fail')) {
      return {
        payoutId,
        status: 'failed',
        failureReason: 'BENEFICIARY_SERVER_TIMEOUT',
      };
    }

    return {
      payoutId,
      status: 'settled',
      utrReference: `42${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      settledAt: new Date().toISOString(),
    };
  }

  public async refundEscrow(params: RefundParams): Promise<RefundResult> {
    if (params.amountInr <= 0) {
      return {
        success: false,
        status: 'failed',
        error: 'Refund amount must be positive',
      };
    }

    return {
      success: true,
      refundId: `rfnd_sbx_${Date.now()}`,
      status: 'processed',
    };
  }

  /**
   * Helper to construct signed webhook payload for test suites
   */
  public generateSignedWebhookPayload(event: {
    event: string;
    payload: Record<string, any>;
  }): { rawBody: string; signature: string; eventId: string } {
    const eventId = `evt_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullBody = JSON.stringify({
      entity: 'event',
      id: eventId,
      event: event.event,
      contains: ['payment', 'payout'],
      payload: event.payload,
      created_at: Math.floor(Date.now() / 1000),
    });

    const signature = generateHmacSha256(fullBody, this.webhookSecret);
    return { rawBody: fullBody, signature, eventId };
  }
}
