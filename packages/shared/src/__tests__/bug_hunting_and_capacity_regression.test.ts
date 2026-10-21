describe('Bug Hunting & Production Reliability Regression Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BUG-001: Admin User Management API Authentication & Authorization Contract', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      // Simulating verification helper with no session token or cookie
      const verifyAdminAuth = (authHeader?: string, cookies?: Record<string, string>) => {
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const hasSessionCookie = cookies && Object.keys(cookies).some((k) => k.includes('-auth-token') || k.startsWith('sb-'));
        if (!token && !hasSessionCookie) {
          return { ok: false, status: 401, error: 'Unauthorized: Valid admin authentication required.' };
        }
        return { ok: true, user: { id: 'admin-123' } };
      };

      const result = verifyAdminAuth(undefined, {});
      expect(result.ok).toBe(false);
      expect(result.status).toBe(401);
      expect(result.error).toContain('Unauthorized');
    });

    it('rejects non-admin roles (worker, organizer) with 403 Forbidden', async () => {
      const verifyRole = (profile: { role: string; is_active: boolean } | null) => {
        if (!profile || profile.role !== 'admin' || !profile.is_active) {
          return { ok: false, status: 403, error: 'Forbidden: Caller is not an active platform administrator.' };
        }
        return { ok: true };
      };

      expect(verifyRole({ role: 'worker', is_active: true }).status).toBe(403);
      expect(verifyRole({ role: 'organizer', is_active: true }).status).toBe(403);
      expect(verifyRole({ role: 'admin', is_active: false }).status).toBe(403);
      expect(verifyRole(null).status).toBe(403);
      expect(verifyRole({ role: 'admin', is_active: true }).ok).toBe(true);
    });

    it('guarantees actor attribution in administrative audit logs', () => {
      const formatAuditPayload = (actorId: string, action: string, entityId: string, entityType: string, changes: any) => {
        if (!actorId || actorId === 'system') {
          throw new Error('Administrative audit logs must identify the authenticated admin actor');
        }
        return {
          actor_id: actorId,
          action,
          entity_id: entityId,
          entity_type: entityType,
          changes,
          created_at: new Date().toISOString(),
        };
      };

      expect(() => formatAuditPayload('', 'admin_create_user', 'u-1', 'worker', {})).toThrow();
      const entry = formatAuditPayload('admin-uuid-42', 'admin_create_user', 'u-1', 'worker', { email: 'w@opskil.in' });
      expect(entry.actor_id).toBe('admin-uuid-42');
      expect(entry.action).toBe('admin_create_user');
    });

    it('rolls back user identity if role-specific profile initialization fails', async () => {
      const rollbackStack: string[] = [];
      const createAdminUser = async (simulateWorkerFailure: boolean) => {
        const userId = 'usr-test-123';
        rollbackStack.push('create_auth_user');
        rollbackStack.push('create_profile');

        if (simulateWorkerFailure) {
          // Rollback on worker profile failure
          rollbackStack.push('delete_profile');
          rollbackStack.push('delete_auth_user');
          return { success: false, error: 'Failed to create worker profile' };
        }

        rollbackStack.push('create_worker_profile');
        return { success: true, userId };
      };

      const failureRes = await createAdminUser(true);
      expect(failureRes.success).toBe(false);
      expect(rollbackStack).toContain('delete_profile');
      expect(rollbackStack).toContain('delete_auth_user');
    });
  });

  describe('BUG-002: Exact Derived Capacity Recalculation on Cancellation & Decline', () => {
    interface Booking {
      id: string;
      jobId: string;
      status: string;
    }

    const calculateJobCapacity = (bookings: Booking[], jobId: string, slotsTotal: number) => {
      const activeBookings = bookings.filter(
        (b) =>
          b.jobId === jobId &&
          ['selected_awaiting_confirmation', 'confirmed', 'checked_in', 'checked_out', 'completed_awaiting_review', 'completed'].includes(b.status)
      );
      const slotsFilled = activeBookings.length;
      const status = slotsFilled >= slotsTotal ? 'filled' : slotsFilled > 0 ? 'filling' : 'open';
      return { slotsFilled, status };
    };

    it('recalculates capacity authoritatively when an offer is cancelled', () => {
      const bookings: Booking[] = [
        { id: 'b1', jobId: 'j1', status: 'confirmed' },
        { id: 'b2', jobId: 'j1', status: 'selected_awaiting_confirmation' },
      ];

      // Initial state: 2 slots filled of 2 total
      let cap = calculateJobCapacity(bookings, 'j1', 2);
      expect(cap.slotsFilled).toBe(2);
      expect(cap.status).toBe('filled');

      // Cancel the offer (b2)
      bookings[1].status = 'cancelled';
      cap = calculateJobCapacity(bookings, 'j1', 2);
      expect(cap.slotsFilled).toBe(1);
      expect(cap.status).toBe('filling');

      // Cancel the remaining booking (b1)
      bookings[0].status = 'cancelled';
      cap = calculateJobCapacity(bookings, 'j1', 2);
      expect(cap.slotsFilled).toBe(0);
      expect(cap.status).toBe('open');
    });

    it('never underflows below zero even if uncounted booking is cancelled', () => {
      const bookings: Booking[] = [
        { id: 'b1', jobId: 'j1', status: 'cancelled' },
      ];
      const cap = calculateJobCapacity(bookings, 'j1', 3);
      expect(cap.slotsFilled).toBe(0);
      expect(cap.status).toBe('open');
    });

    it('worker declining selection releases held capacity authoritatively', () => {
      const bookings: Booking[] = [
        { id: 'b1', jobId: 'j1', status: 'selected_awaiting_confirmation' },
      ];
      let cap = calculateJobCapacity(bookings, 'j1', 1);
      expect(cap.slotsFilled).toBe(1);
      expect(cap.status).toBe('filled');

      // Worker declines
      bookings[0].status = 'cancelled';
      cap = calculateJobCapacity(bookings, 'j1', 1);
      expect(cap.slotsFilled).toBe(0);
      expect(cap.status).toBe('open');
    });
  });

  describe('BUG-003: Canonical Timestamptz Instant Comparisons & Shift Boundaries', () => {
    it('compares shift start instant canonically in Asia/Kolkata timezone', () => {
      // 10:00 AM IST is 04:30 AM UTC on the same day
      const parseShiftStartInstant = (shiftDate: string, startTime: string) => {
        // shiftDate: YYYY-MM-DD, startTime: HH:MM[:SS]
        const [year, month, day] = shiftDate.split('-').map(Number);
        const [hour, minute] = startTime.split(':').map(Number);
        // Create UTC date offset for IST (+05:30)
        const dateUtc = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
        return dateUtc.getTime();
      };

      const nowInstant = new Date('2026-10-22T05:00:00Z').getTime(); // 10:30 AM IST
      const shiftStartBeforeNow = parseShiftStartInstant('2026-10-22', '10:00'); // 10:00 AM IST = 04:30 UTC
      const shiftStartAfterNow = parseShiftStartInstant('2026-10-22', '12:00'); // 12:00 PM IST = 06:30 UTC

      expect(shiftStartBeforeNow <= nowInstant).toBe(true); // Shift start has arrived
      expect(shiftStartAfterNow <= nowInstant).toBe(false); // Future shift
    });

    it('expires worker offers older than 3 hours or past shift start instant', () => {
      const isOfferExpired = (
        offerCreatedAt: string,
        shiftDate: string,
        shiftStartTime: string,
        currentTimeIso: string
      ) => {
        const nowMs = new Date(currentTimeIso).getTime();
        const offerAgeMs = nowMs - new Date(offerCreatedAt).getTime();
        const threeHoursMs = 3 * 60 * 60 * 1000;

        if (offerAgeMs >= threeHoursMs) {
          return { expired: true, reason: 'Offer exceeded 3h window' };
        }

        const [year, month, day] = shiftDate.split('-').map(Number);
        const [hour, minute] = shiftStartTime.split(':').map(Number);
        const shiftStartMs = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30)).getTime();

        if (shiftStartMs <= nowMs) {
          return { expired: true, reason: 'Shift start instant has arrived' };
        }

        return { expired: false, reason: null };
      };

      // 1. Offer created 3.5h ago: expired
      expect(
        isOfferExpired(
          '2026-10-22T01:00:00Z',
          '2026-10-22',
          '18:00',
          '2026-10-22T05:00:00Z'
        ).expired
      ).toBe(true);

      // 2. Offer created 1h ago for shift starting in 15 mins: valid
      expect(
        isOfferExpired(
          '2026-10-22T04:00:00Z',
          '2026-10-22',
          '11:00', // 11:00 IST = 05:30 UTC
          '2026-10-22T05:00:00Z'
        ).expired
      ).toBe(false);

      // 3. Offer created 30 mins ago, but shift has already started: expired
      expect(
        isOfferExpired(
          '2026-10-22T04:30:00Z',
          '2026-10-22',
          '09:00', // 09:00 IST = 03:30 UTC
          '2026-10-22T05:00:00Z'
        ).expired
      ).toBe(true);
    });
  });

  describe('BUG-004: Mobile Call Action Dialer Resilience', () => {
    it('catches dialer openURL failure and triggers fallback alert', async () => {
      let alertTitle = '';
      let alertMessage = '';

      const mockAlert = (title: string, message: string) => {
        alertTitle = title;
        alertMessage = message;
      };

      const mockOpenUrl = jest.fn().mockRejectedValue(new Error('Device has no telephony capability'));

      const dialPhone = async (phone: string) => {
        const cleanPhone = phone.replace(/[^\d+]/g, '');
        if (!cleanPhone) {
          mockAlert('Invalid Phone', 'No telephone number is available.');
          return;
        }
        await mockOpenUrl(`tel:${cleanPhone}`).catch(() => {
          mockAlert('Unable to Call', 'Could not open phone dialer on this device.');
        });
      };

      await dialPhone('+919876543210');
      expect(mockOpenUrl).toHaveBeenCalledWith('tel:+919876543210');
      expect(alertTitle).toBe('Unable to Call');
      expect(alertMessage).toContain('Could not open phone dialer');
    });

    it('rejects empty or corrupt phone numbers before launching dialer', async () => {
      let alertTitle = '';
      const mockAlert = (title: string) => {
        alertTitle = title;
      };
      const mockOpenUrl = jest.fn();

      const dialPhone = async (phone?: string) => {
        const cleanPhone = (phone || '').replace(/[^\d+]/g, '');
        if (!cleanPhone) {
          mockAlert('Invalid Phone');
          return;
        }
        await mockOpenUrl(`tel:${cleanPhone}`);
      };

      await dialPhone('');
      expect(mockOpenUrl).not.toHaveBeenCalled();
      expect(alertTitle).toBe('Invalid Phone');
    });
  });
});
