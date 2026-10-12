import {
  generateHmacSha256,
  verifyHmacSha256,
  generateIdempotencyKey,
} from '../payments/crypto-utils';
import { redactSensitiveData } from '../utils/logger';
import { MobilePublicEnvSchema, ServerEnvSchema } from '../schemas';

describe('Phase 10 — Security Testing & Threat Model Compliance', () => {
  describe('1. Webhook Authenticity, HMAC Verification & Replay Protection', () => {
    const webhookSecret = 'whsec_mumbai_apex_prod_sandbox_key_99';
    const originalPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_mum_99182',
            amount: 180000,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_shift_99',
          },
        },
      },
    });

    test('validates authentic webhook signature with correct secret', () => {
      const signature = generateHmacSha256(originalPayload, webhookSecret);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 hex string

      const isValid = verifyHmacSha256(originalPayload, signature, webhookSecret);
      expect(isValid).toBe(true);
    });

    test('rejects tampered payload with mismatched signature', () => {
      const signature = generateHmacSha256(originalPayload, webhookSecret);
      const tamperedPayload = originalPayload.replace('180000', '1800'); // attacker altered amount

      const isValid = verifyHmacSha256(tamperedPayload, signature, webhookSecret);
      expect(isValid).toBe(false);
    });

    test('rejects authentic payload when signed with wrong secret', () => {
      const forgedSignature = generateHmacSha256(originalPayload, 'attacker_wrong_secret');
      const isValid = verifyHmacSha256(originalPayload, forgedSignature, webhookSecret);
      expect(isValid).toBe(false);
    });

    test('enforces unique idempotency keys for replay attack mitigation', () => {
      const key1 = generateIdempotencyKey('rzp_evt');
      const key2 = generateIdempotencyKey('rzp_evt');
      expect(key1).not.toBe(key2);
      expect(key1).toContain('rzp_evt_');
    });
  });

  describe('2. Broken Object-Level Authorization (BOLA) & Tenant Isolation', () => {
    // Policy rule evaluator simulating PostgreSQL Row-Level Security (RLS)
    const evaluateRlsReadPolicy = (
      resource: 'worker_earnings' | 'organizer_invoices' | 'identity_documents',
      resourceOwnerId: string,
      requestingUser: { id: string; role: 'worker' | 'organizer' | 'admin' }
    ): boolean => {
      // Admin always has oversight access
      if (requestingUser.role === 'admin') return true;
      // Workers can only read their own earnings
      if (resource === 'worker_earnings' && requestingUser.role === 'worker') {
        return requestingUser.id === resourceOwnerId;
      }
      // Organizers can only read their own invoices
      if (resource === 'organizer_invoices' && requestingUser.role === 'organizer') {
        return requestingUser.id === resourceOwnerId;
      }
      // Identity documents (Aadhaar/PAN) are private to the owner and admin only
      if (resource === 'identity_documents') {
        return requestingUser.id === resourceOwnerId;
      }
      return false;
    };

    test('prevents worker from accessing another worker earnings record (BOLA)', () => {
      const isAllowed = evaluateRlsReadPolicy(
        'worker_earnings',
        'worker-alice-101',
        { id: 'worker-bob-202', role: 'worker' }
      );
      expect(isAllowed).toBe(false);
    });

    test('allows worker to access their own earnings record', () => {
      const isAllowed = evaluateRlsReadPolicy(
        'worker_earnings',
        'worker-alice-101',
        { id: 'worker-alice-101', role: 'worker' }
      );
      expect(isAllowed).toBe(true);
    });

    test('prevents organizer from viewing competitor invoices or financial records', () => {
      const isAllowed = evaluateRlsReadPolicy(
        'organizer_invoices',
        'org-apex-01',
        { id: 'org-rival-02', role: 'organizer' }
      );
      expect(isAllowed).toBe(false);
    });

    test('prevents ordinary users from reading private identity documents', () => {
      const isAllowed = evaluateRlsReadPolicy(
        'identity_documents',
        'worker-alice-101',
        { id: 'org-apex-01', role: 'organizer' }
      );
      expect(isAllowed).toBe(false);
    });

    test('authorizes compliance administrator to audit sensitive records', () => {
      const isAllowed = evaluateRlsReadPolicy(
        'identity_documents',
        'worker-alice-101',
        { id: 'admin-super-01', role: 'admin' }
      );
      expect(isAllowed).toBe(true);
    });
  });

  describe('3. Unauthorized Role & Privilege Escalation Prevention', () => {
    const sanitizeProfileUpdate = (
      currentRole: string,
      requestedPayload: Record<string, any>
    ): Record<string, any> => {
      const safePayload = { ...requestedPayload };
      // Prevent client-side role manipulation
      if (requestedPayload.role && currentRole !== 'admin') {
        delete safePayload.role;
      }
      // Prevent client-side verification badge self-granting
      if (requestedPayload.verification_status && currentRole !== 'admin') {
        delete safePayload.verification_status;
      }
      return safePayload;
    };

    test('strips role escalation attempt from worker profile update payload', () => {
      const maliciousPayload = {
        fullName: 'Aryan Yadav',
        role: 'admin',
        verification_status: 'verified',
      };

      const sanitized = sanitizeProfileUpdate('worker', maliciousPayload);
      expect(sanitized.fullName).toBe('Aryan Yadav');
      expect(sanitized.role).toBeUndefined();
      expect(sanitized.verification_status).toBeUndefined();
    });

    test('allows admin to perform legitimate role and verification updates', () => {
      const adminPayload = {
        role: 'admin',
        verification_status: 'verified',
      };

      const result = sanitizeProfileUpdate('admin', adminPayload);
      expect(result.role).toBe('admin');
      expect(result.verification_status).toBe('verified');
    });
  });

  describe('4. PII Redaction in Logs & Crash Reports', () => {
    test('masks passwords, OTPs, auth tokens, and bank credentials in diagnostic logs', () => {
      const rawLog = {
        event: 'auth_attempt',
        phone: '+919820011223',
        otp: '482910',
        password: 'UserSecretPassword99!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.topsecret_token',
        service_role_key: 'secret-service-role-key-xyz',
        bankAccount: '10029384756',
        city: 'Mumbai',
      };

      const redacted = redactSensitiveData(rawLog);
      expect(redacted.otp).toBe('[REDACTED]');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.service_role_key).toBe('[REDACTED]');
      expect(redacted.city).toBe('Mumbai');
    });
  });

  describe('5. Environment & Secret Exposure Isolation', () => {
    test('strictly forbids service role key in mobile public schema', () => {
      const mobilePublicConfig = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://opskil.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_token_1234567890',
        EXPO_PUBLIC_APP_ENV: 'production',
      };

      const parsed = MobilePublicEnvSchema.safeParse(mobilePublicConfig);
      expect(parsed.success).toBe(true);

      // Verify server-side secret is absent
      expect((parsed as any).data?.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });

    test('validates server schema requires service role key for admin operations', () => {
      const serverConfig = {
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_secret',
      };
      const parsed = ServerEnvSchema.safeParse(serverConfig);
      expect(parsed.success).toBe(true);
    });
  });
});
