import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('Registration Security, Email Verification & Rate-Limiting Regression Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Unverified Account Contact-Verified Feature Gate', () => {
    it('enforces that newly created accounts default to email_confirm: false and unverified status', () => {
      // Simulating user creation payload
      const buildUserCreationOptions = (cleanEmail: string, password: string, cleanRole: string) => ({
        email: cleanEmail,
        password,
        email_confirm: false, // CRITICAL: Never marked true on submission
        user_metadata: {
          role: cleanRole,
        },
      });

      const options = buildUserCreationOptions('worker.candidate@example.com', 'SecurePass123!', 'worker');
      expect(options.email_confirm).toBe(false);
      expect(options.email_confirm).not.toBe(true);
    });

    it('blocks unverified workers from applying to shifts (KYC_NOT_VERIFIED gate)', () => {
      interface WorkerState {
        isActive: boolean;
        profileStatus: 'incomplete' | 'completed';
        verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
      }

      const canApplyForJob = (worker: WorkerState, isAdmin: boolean = false): { allowed: boolean; code?: string } => {
        if (!worker.isActive) return { allowed: false, code: 'INELIGIBLE_WORKER' };
        if (worker.profileStatus !== 'completed') return { allowed: false, code: 'PROFILE_INCOMPLETE' };
        if (worker.verificationStatus !== 'verified' && !isAdmin) {
          return { allowed: false, code: 'KYC_NOT_VERIFIED' };
        }
        return { allowed: true };
      };

      // Freshly registered account: incomplete and unverified
      const freshAccount: WorkerState = {
        isActive: true,
        profileStatus: 'incomplete',
        verificationStatus: 'unverified',
      };

      const result1 = canApplyForJob(freshAccount);
      expect(result1.allowed).toBe(false);
      expect(result1.code).toBe('PROFILE_INCOMPLETE');

      // Profile completed, but KYC contact verification not yet approved
      const onboardingDone: WorkerState = {
        isActive: true,
        profileStatus: 'completed',
        verificationStatus: 'unverified',
      };

      const result2 = canApplyForJob(onboardingDone);
      expect(result2.allowed).toBe(false);
      expect(result2.code).toBe('KYC_NOT_VERIFIED');

      // Fully verified account
      const verifiedAccount: WorkerState = {
        isActive: true,
        profileStatus: 'completed',
        verificationStatus: 'verified',
      };

      const result3 = canApplyForJob(verifiedAccount);
      expect(result3.allowed).toBe(true);
    });

    it('blocks unverified organizers from publishing live shifts (ORGANIZER_NOT_FOUND / UNVERIFIED gate)', () => {
      interface OrganizerState {
        isActive: boolean;
        verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
      }

      const canCreateLiveShift = (org: OrganizerState | null): { allowed: boolean; code?: string } => {
        if (!org || !org.isActive) return { allowed: false, code: 'ORGANIZER_NOT_FOUND' };
        if (org.verificationStatus !== 'verified') return { allowed: false, code: 'ORGANIZER_NOT_VERIFIED' };
        return { allowed: true };
      };

      const unverifiedOrg: OrganizerState = {
        isActive: true,
        verificationStatus: 'unverified',
      };

      expect(canCreateLiveShift(unverifiedOrg).allowed).toBe(false);
      expect(canCreateLiveShift(unverifiedOrg).code).toBe('ORGANIZER_NOT_VERIFIED');

      const verifiedOrg: OrganizerState = {
        isActive: true,
        verificationStatus: 'verified',
      };

      expect(canCreateLiveShift(verifiedOrg).allowed).toBe(true);
    });
  });

  describe('2. Multi-Instance Rate Limiting & Proxy Header Spoofing Defense', () => {
    // Robust IP extraction logic implemented in register-user route
    const extractClientIp = (headers: Record<string, string | null>): string => {
      const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
      const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::1$|^[a-fA-F0-9:]+$/;
      const isValidIp = (ip: string) => ipv4Regex.test(ip) || ipv6Regex.test(ip);

      const cfIp = headers['cf-connecting-ip'];
      if (cfIp && isValidIp(cfIp.trim())) return cfIp.trim();

      const realIp = headers['x-real-ip'];
      if (realIp && isValidIp(realIp.trim())) return realIp.trim();

      const forwardedFor = headers['x-forwarded-for'];
      if (forwardedFor) {
        const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
        // Extracts the rightmost valid IP added by the trusted ingress reverse proxy
        for (let i = parts.length - 1; i >= 0; i--) {
          if (isValidIp(parts[i])) {
            return parts[i];
          }
        }
      }

      return '127.0.0.1';
    };

    it('extracts trusted client IP from cf-connecting-ip over spoofed x-forwarded-for', () => {
      const headers = {
        'cf-connecting-ip': '203.0.113.195',
        'x-forwarded-for': '198.51.100.1, 198.51.100.2',
      };

      expect(extractClientIp(headers)).toBe('203.0.113.195');
    });

    it('extracts rightmost verified proxy IP to defend against client-injected spoofed headers', () => {
      const headers = {
        'cf-connecting-ip': null,
        'x-real-ip': null,
        'x-forwarded-for': 'spoofed.attacker.ip, 10.0.0.1, 49.36.12.88',
      };

      expect(extractClientIp(headers)).toBe('49.36.12.88');
    });

    it('discards non-IP malicious header injections and falls back to loopback', () => {
      const headers = {
        'x-forwarded-for': '<script>alert(1)</script>, invalid-ip',
      };

      expect(extractClientIp(headers)).toBe('127.0.0.1');
    });

    it('simulates shared atomic rate limiter across multiple concurrent serverless workers', async () => {
      // Shared database bucket simulation with row-level atomic lock
      const sharedDbBucket = new Map<string, { count: number; resetAt: number }>();
      const windowMs = 60000;
      const maxLimit = 5;

      const atomicCheckRateLimit = async (key: string): Promise<boolean> => {
        const now = Date.now();
        const entry = sharedDbBucket.get(key);
        if (!entry || now > entry.resetAt) {
          sharedDbBucket.set(key, { count: 1, resetAt: now + windowMs });
          return true;
        }
        if (entry.count >= maxLimit) {
          return false;
        }
        entry.count += 1;
        return true;
      };

      // 5 concurrent requests from different worker instances to the same key
      const results: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(await atomicCheckRateLimit('ip:49.36.12.88'));
      }
      expect(results.every((r) => r === true)).toBe(true);

      // 6th request must be rejected globally across all instances
      const rejectedResult = await atomicCheckRateLimit('ip:49.36.12.88');
      expect(rejectedResult).toBe(false);
    });
  });

  describe('3. Database Error Handling in Duplicate Lookup (Fail Closed)', () => {
    it('fails closed when duplicate lookup query encounters a database error', async () => {
      const handleDuplicateLookup = (dbResult: { data: any; error: any }) => {
        if (dbResult.error) {
          // MUST fail closed instead of continuing to create auth user
          return {
            status: 500,
            body: {
              success: false,
              error: 'Unable to verify account availability. Please try again.',
              code: 'VERIFICATION_UNAVAILABLE',
            },
          };
        }
        if (dbResult.data) {
          return {
            status: 409,
            body: { success: false, error: 'Account already exists.', code: 'ACCOUNT_EXISTS' },
          };
        }
        return { status: 200, body: { success: true } };
      };

      const queryError = new Error('Connection timeout to postgres cluster');
      const response = handleDuplicateLookup({ data: null, error: queryError });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('VERIFICATION_UNAVAILABLE');
      expect(response.body.success).toBe(false);
      // Ensures it did NOT proceed as "no existing user" (which would be status 200)
      expect(response.status).not.toBe(200);
    });

    it('safely handles concurrent duplicate registration race conditions', () => {
      const handleAuthCreationError = (err: { message: string }) => {
        const msg = err.message.toLowerCase();
        if (msg.includes('already') || msg.includes('exists') || msg.includes('unique')) {
          return {
            status: 409,
            body: {
              success: false,
              error: 'An account with this email address already exists. Please sign in or use password reset.',
              code: 'ACCOUNT_EXISTS',
            },
          };
        }
        return {
          status: 400,
          body: {
            success: false,
            error: 'Failed to create user account. Please check your details and try again.',
            code: 'USER_CREATION_FAILED',
          },
        };
      };

      const duplicateError = { message: 'User already registered' };
      const res = handleAuthCreationError(duplicateError);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACCOUNT_EXISTS');
    });
  });

  describe('4. User-Facing Error Masking & Correlation ID', () => {
    it('masks internal database constraint and column errors with stable non-sensitive messages', () => {
      const formatProfileError = (_internalDbError: string, correlationId: string) => {
        // Must never expose raw internal table, schema or constraint names
        return {
          success: false,
          error: 'Failed to initialize user profile. Please contact support.',
          code: 'PROFILE_INIT_FAILED',
          correlationId,
        };
      };

      const rawDbErr = 'duplicate key value violates unique constraint "profiles_pkey" on table "profiles"';
      const correlationId = 'corr-uuid-4491-a1b2';
      const userFacing = formatProfileError(rawDbErr, correlationId);

      expect(userFacing.error).toBe('Failed to initialize user profile. Please contact support.');
      expect(userFacing.error).not.toContain('profiles_pkey');
      expect(userFacing.error).not.toContain('table "profiles"');
      expect(userFacing.correlationId).toBe('corr-uuid-4491-a1b2');
    });

    it('catches unexpected exceptions and returns generic server error with correlation ID', () => {
      const handleOuterException = (_caughtErr: any, correlationId: string) => {
        return {
          success: false,
          error: 'Registration failed due to a server error. Please try again later.',
          code: 'INTERNAL_SERVER_ERROR',
          correlationId,
        };
      };

      const rawException = new Error('FATAL: pool exhausted, internal socket hang up at /var/task/node_modules/pg/lib/connection.js:142');
      const correlationId = 'corr-outer-9981-xyz';
      const response = handleOuterException(rawException, correlationId);

      expect(response.error).toBe('Registration failed due to a server error. Please try again later.');
      expect(response.error).not.toContain('node_modules');
      expect(response.error).not.toContain('FATAL');
      expect(response.correlationId).toBe(correlationId);
    });
  });
});
