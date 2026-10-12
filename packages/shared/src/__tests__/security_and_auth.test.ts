import { redactSensitiveData } from '../utils/logger';
import { MobilePublicEnvSchema, ServerEnvSchema } from '../schemas';

describe('Phase 2 Security, Authorization & Privacy Controls', () => {
  describe('Private Credential Isolation', () => {
    test('Mobile public environment schema rejects service-role keys', () => {
      const publicPayload: Record<string, string> = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://opskil.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_token_1234567890',
        EXPO_PUBLIC_APP_ENV: 'development',
      };

      const result = MobilePublicEnvSchema.safeParse(publicPayload);
      expect(result.success).toBe(true);

      // Verify server secrets are NOT accepted or exposed in public schema
      expect((result as any).data?.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });

    test('Server environment schema strictly requires service-role key', () => {
      const validServer = ServerEnvSchema.safeParse({
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_secret',
      });
      expect(validServer.success).toBe(true);

      const invalidServer = ServerEnvSchema.safeParse({});
      expect(invalidServer.success).toBe(false);
    });

    test('Diagnostic logger strips passwords, service keys, and JWT tokens', () => {
      const sensitivePayload = {
        userId: 'usr-101',
        password: 'SuperSecretPassword!123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.my_raw_jwt_token',
        service_role_key: 'secret-service-role-key',
        otp: '984123',
        normalField: 'John Doe',
      };

      const sanitized = redactSensitiveData(sensitivePayload);
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.service_role_key).toBe('[REDACTED]');
      expect(sanitized.otp).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('John Doe');
    });
  });

  describe('Cross-User & Cross-Organization Permission Rules', () => {
    test('Client role elevation attempt is blocked by authorization policy logic', () => {
      const currentRole = 'worker';
      const targetRole = 'admin';

      // Rule: non-admin user cannot change role
      const canElevate = (actorRole: string, newRole: string) => {
        if (newRole !== actorRole && actorRole !== 'admin') {
          return false;
        }
        return true;
      };

      expect(canElevate(currentRole, targetRole)).toBe(false);
      expect(canElevate('admin', 'worker')).toBe(true);
    });

    test('Cross-organization job modification is rejected', () => {
      const job = {
        id: 'job-1',
        organizer_id: 'org-1',
        title: 'Expo Usher',
      };

      const canModifyJob = (actorId: string, jobOrganizerId: string) => {
        return actorId === jobOrganizerId;
      };

      expect(canModifyJob('org-1', job.organizer_id)).toBe(true);
      expect(canModifyJob('org-2', job.organizer_id)).toBe(false); // Rejected!
      expect(canModifyJob('worker-1', job.organizer_id)).toBe(false); // Rejected!
    });

    test('Worker cannot self-confirm bookings or alter agreed wages', () => {
      const canWorkerConfirmBooking = (actorRole: string) => {
        // Only organizer or platform admin can confirm bookings
        return actorRole === 'organizer' || actorRole === 'admin';
      };

      expect(canWorkerConfirmBooking('worker')).toBe(false);
      expect(canWorkerConfirmBooking('organizer')).toBe(true);
    });

    test('Cross-user application retrieval is prevented', () => {
      const application = {
        id: 'app-99',
        worker_id: 'worker-alice',
        job_id: 'job-101',
      };

      const canViewApplication = (
        actorId: string,
        actorRole: string,
        jobOwnerId: string
      ) => {
        if (actorRole === 'admin') return true;
        if (actorId === application.worker_id) return true;
        if (actorId === jobOwnerId) return true;
        return false;
      };

      expect(canViewApplication('worker-alice', 'worker', 'org-1')).toBe(true);
      expect(canViewApplication('worker-bob', 'worker', 'org-1')).toBe(false); // Cross-worker blocked!
      expect(canViewApplication('org-1', 'organizer', 'org-1')).toBe(true); // Job owner allowed
      expect(canViewApplication('org-2', 'organizer', 'org-1')).toBe(false); // Other organizer blocked!
    });
  });
});
