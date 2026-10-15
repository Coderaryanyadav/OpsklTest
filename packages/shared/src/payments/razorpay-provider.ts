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
import { verifyHmacSha256 } from './crypto-utils';
import { isValidIndianUpiId } from './calculator';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  accountNumber?: string; // RazorpayX virtual account for payouts
}

function safeBase64Encode(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value).toString('base64');
  }
  if (typeof btoa === 'function') {
    return btoa(value);
  }
  return '';
}

/**
 * Production-ready Razorpay Route / RazorpayX Payouts Provider Adapter
 * 
 * Live Integration Requirements:
 * 1. Merchant Onboarding & RBI PA (Payment Aggregator) Compliance:
 *    - Opskl must be registered as an intermediary/marketplace platform.
 *    - Bank escrow nodal account must be linked under RBI guidelines.
 * 2. RazorpayX Payouts Account:
 *    - Current account linked with 24x7 IMPS / UPI transfer capability.
 *    - API Key ID, Key Secret, and Webhook Secret stored securely in environment variables.
 * 3. Mobile Client Security Constraint:
 *    - Mobile apps NEVER initiate or settle payments directly.
 *    - Mobile apps only present checkout UI with server-generated order IDs.
 *    - Only verified webhook events or backend polling transitions payment state to 'settled'.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  public readonly providerName = 'razorpay';
  public readonly isSandbox = false;

  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private accountNumber?: string;

  constructor(config: RazorpayConfig) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    this.accountNumber = config.accountNumber;
  }

  public async createEscrowOrder(params: CreateOrderParams): Promise<OrderResult> {
    if (!this.keyId || !this.keySecret) {
      return {
        success: false,
        amountInr: params.amountInr,
        currency: 'INR',
        provider: this.providerName,
        isSandbox: false,
        error: 'Live Razorpay API credentials are not configured.',
      };
    }

    try {
      // In a production server/edge function environment, this calls Razorpay API:
      // POST https://api.razorpay.com/v1/orders
      // Authorization: Basic base64(keyId:keySecret)
      // Body: { amount: amountInPaise, currency: "INR", receipt: params.receiptInvoiceNumber }
      const amountInPaise = Math.round(params.amountInr * 100);
      const authHeader = safeBase64Encode(`${this.keyId}:${this.keySecret}`);

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: params.receiptInvoiceNumber,
          notes: params.notes || {},
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          amountInr: params.amountInr,
          currency: 'INR',
          provider: this.providerName,
          isSandbox: false,
          error: errorData.error?.description || `Razorpay order creation failed: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        orderId: data.id,
        amountInr: params.amountInr,
        currency: 'INR',
        provider: this.providerName,
        isSandbox: false,
      };
    } catch (err: any) {
      return {
        success: false,
        amountInr: params.amountInr,
        currency: 'INR',
        provider: this.providerName,
        isSandbox: false,
        error: err.message || 'Network error communicating with Razorpay API',
      };
    }
  }

  public verifyWebhookSignature(params: WebhookVerificationParams): boolean {
    const secret = params.secret || this.webhookSecret;
    return verifyHmacSha256(params.rawBody, params.signature, secret);
  }

  public async disburseWorkerPayout(params: DisbursePayoutParams): Promise<PayoutResult> {
    if (!isValidIndianUpiId(params.upiId)) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'INVALID_UPI_HANDLE',
        isSandbox: false,
        error: `Invalid UPI handle "${params.upiId}".`,
      };
    }

    if (!this.keyId || !this.keySecret || !this.accountNumber) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'CREDENTIALS_MISSING',
        isSandbox: false,
        error: 'RazorpayX payout credentials or account number not configured.',
      };
    }

    try {
      // POST https://api.razorpay.com/v1/payouts
      const amountInPaise = Math.round(params.amountInr * 100);
      const authHeader = safeBase64Encode(`${this.keyId}:${this.keySecret}`);

      const response = await fetch('https://api.razorpay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payout-Idempotency': params.idempotencyKey,
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          account_number: this.accountNumber,
          amount: amountInPaise,
          currency: 'INR',
          mode: 'UPI',
          purpose: 'payout',
          fund_account: {
            account_type: 'vpa',
            vpa: {
              address: params.upiId,
            },
          },
          narration: params.narration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          status: 'failed',
          failureReason: errorData.error?.code || 'PAYOUT_API_FAILED',
          isSandbox: false,
          error: errorData.error?.description || 'RazorpayX payout rejected',
        };
      }

      const data = await response.json();
      return {
        success: true,
        payoutId: data.id,
        utrReference: data.utr || undefined,
        status: data.status === 'processed' ? 'settled' : 'processing',
        isSandbox: false,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        failureReason: 'NETWORK_ERROR',
        isSandbox: false,
        error: err.message || 'Failed to disburse payout via RazorpayX',
      };
    }
  }

  public async getPayoutStatus(payoutId: string): Promise<PayoutStatusResult> {
    const authHeader = safeBase64Encode(`${this.keyId}:${this.keySecret}`);
    const response = await fetch(`https://api.razorpay.com/v1/payouts/${payoutId}`, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      return {
        payoutId,
        status: 'processing',
      };
    }

    const data = await response.json();
    return {
      payoutId,
      status: data.status === 'processed' ? 'settled' : data.status === 'failed' ? 'failed' : 'processing',
      utrReference: data.utr,
      failureReason: data.failure_reason,
      settledAt: data.processed_at ? new Date(data.processed_at * 1000).toISOString() : undefined,
    };
  }

  public async refundEscrow(params: RefundParams): Promise<RefundResult> {
    const authHeader = safeBase64Encode(`${this.keyId}:${this.keySecret}`);
    const response = await fetch(`https://api.razorpay.com/v1/payments/${params.paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: Math.round(params.amountInr * 100),
        notes: { reason: params.reason },
      }),
    });

    if (!response.ok) {
      return { success: false, status: 'failed' };
    }

    const data = await response.json();
    return {
      success: true,
      refundId: data.id,
      status: 'processed',
    };
  }
}
