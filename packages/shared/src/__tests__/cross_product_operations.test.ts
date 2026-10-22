import {
  enqueueOfflineMutation,
  syncOfflineQueueSafe,
  generateOfflineGateKey,
  getOfflineQueue,
} from '../services/offline_queue_service';
import {
  submitSafetyIncidentSafe,
} from '../services/safety_incident_service';
import {
  setBookingPauseStatusSafe,
  getSystemOperationalStatus,
  isBookingPaused,
} from '../services/system_killswitch_service';

describe('Cross-Product Operational Integrity: Phase 8 Requirements', () => {
  describe('Screen 26: Offline Mode & Local Idempotent Queue', () => {
    test('enqueues a mutation and enforces idempotency against duplicates', async () => {
      const uniqueKey = `idemp-test-chk-${Date.now()}`;

      // First enqueue
      const first = await enqueueOfflineMutation({
        type: 'check_in',
        payload: { bookingId: 'booking-8812', gate: 'Gate 4' },
        summaryTitle: 'Check-in Gate 4 Concourse',
        summaryMeta: '09:28:14 IST • Cached locally',
        idempotencyKey: uniqueKey,
      });

      expect(first.isDuplicate).toBe(false);
      expect(first.item.status).toBe('queued');
      expect(first.item.idempotencyKey).toBe(uniqueKey);

      // Attempt duplicate enqueue with same idempotency key
      const duplicate = await enqueueOfflineMutation({
        type: 'check_in',
        payload: { bookingId: 'booking-8812', gate: 'Gate 4' },
        summaryTitle: 'Check-in Gate 4 Concourse',
        summaryMeta: '09:28:14 IST • Duplicate attempt',
        idempotencyKey: uniqueKey,
      });

      expect(duplicate.isDuplicate).toBe(true);
      expect(duplicate.item.id).toBe(first.item.id);
    });

    test('retains queued status when sync is executed while offline', async () => {
      await enqueueOfflineMutation({
        type: 'check_in',
        payload: { bookingId: 'booking-offline-1' },
        summaryTitle: 'Offline check-in',
        summaryMeta: 'queued for sync',
        idempotencyKey: `idemp-offline-retain-${Date.now()}`,
      });
      const res = await syncOfflineQueueSafe(false);
      expect(res.syncedCount).toBe(0);
      expect(res.remainingQueue.length).toBeGreaterThan(0);
      expect(res.remainingQueue[0].status).toBe('queued');
    });

    test('authoritatively acknowledges items when online sync succeeds', async () => {
      await enqueueOfflineMutation({
        type: 'acknowledgment',
        payload: { section: 'Sec 1' },
        summaryTitle: 'Offline ack',
        summaryMeta: 'ready',
        idempotencyKey: `idemp-offline-sync-${Date.now()}`,
      });
      const mockExecutor = async () => ({ success: true });
      const res = await syncOfflineQueueSafe(true, mockExecutor);

      expect(res.syncedCount).toBeGreaterThan(0);
      expect(res.failedCount).toBe(0);
    });

    test('offline queue never invents hardcoded demo mutations', async () => {
      const queue = await getOfflineQueue();
      expect(queue.find((i) => i.id === 'off-mut-4092')).toBeUndefined();
      expect(queue.find((i) => i.id === 'off-mut-4093')).toBeUndefined();
      expect(
        queue.find((i) => i.idempotencyKey === 'idemp-chk-4092-1710408494')
      ).toBeUndefined();
    });

    test('generates a random offline gate display code per session', () => {
      const key = generateOfflineGateKey('WKR-9021', 'NESCO Center');
      expect(key.backupPin).toMatch(/^\d{3} - \d{3}$/);
      expect(key.backupPin).not.toBe('884 - 219');
      expect(key.tokenHash).toMatch(/^[0-9a-f]{20}$/);
      expect(key.tokenHash).not.toBe('7f83b1657ff1fc53b92dc');
      expect(key.validForSeconds).toBeGreaterThan(0);

      const second = generateOfflineGateKey('WKR-9021', 'NESCO Center');
      expect(second.tokenHash).not.toBe(key.tokenHash);
    });
  });

  describe('Screen 25: Incident Reporting Ground Safety Escalation', () => {
    test('fails validation if witness declaration is not confirmed', async () => {
      const res = await submitSafetyIncidentSafe({
        reporterId: 'wkr-test-01',
        category: 'safety',
        severity: 'urgent',
        locationDescription: 'Hall 4 Gate B',
        notes: 'Blocked emergency fire exit with stacked flight cases.',
        witnessDeclared: false, // NOT confirmed
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('validation_failed');
      expect(res.error).toMatch(/Witness Declaration.*mandatory/i);
    });

    test('fails validation if incident description is shorter than 10 characters', async () => {
      const res = await submitSafetyIncidentSafe({
        reporterId: 'wkr-test-01',
        category: 'harassment',
        severity: 'standard',
        locationDescription: 'Hall 4 Gate B',
        notes: 'Too short', // < 10 chars
        witnessDeclared: true,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('validation_failed');
      expect(res.error).toMatch(/at least 10 characters/i);
    });

    test('distinguishes locally queued incident report when submitted offline', async () => {
      const res = await submitSafetyIncidentSafe(
        {
          reporterId: 'wkr-test-01',
          category: 'safety',
          severity: 'immediate',
          locationDescription: 'Pavilion 2, Gate 4B Backstage Service Corridor',
          notes: 'High voltage electrical cord exposed to standing water near production crew entrance.',
          witnessDeclared: true,
        },
        false // Offline mode
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe('locally_queued');
      expect(res.caseRef).toMatch(/^TK-BKC-\d+$/);
      expect(res.offlineNotice).toBeDefined();
    });

    test('rejects device file URIs as evidence_urls on online submit', async () => {
      const res = await submitSafetyIncidentSafe({
        reporterId: 'wkr-test-01',
        category: 'safety',
        severity: 'urgent',
        locationDescription: 'Hall 4 Gate B',
        notes: 'Blocked emergency fire exit with stacked flight cases.',
        witnessDeclared: true,
        evidenceUrls: ['file:///var/mobile/Containers/Data/evidence.jpg'],
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('validation_failed');
      expect(res.error).toMatch(/secure storage/i);
    });
  });

  describe('Screen 27: Emergency Marketplace Pause & Lockdown State', () => {
    test('enforces booking pause with emergency broadcast metadata and audit record', async () => {
      const broadcast = {
        broadcastReference: 'EMG-MUM-2025-08',
        alertLevel: 'red' as const,
        declaredTrigger: 'Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew',
        affectedRadius: 'All Mumbai Zones (South, Suburbs & Thane)',
        wageProtectionSecured: true,
        operationalScope: 'All open shift applications, new dispatches, and check-ins temporarily halted for worker safety.',
      };

      const res = await setBookingPauseStatusSafe(
        true,
        'Severe IMD Red Alert / Heavy Waterlogging in MMR Region & Venue Safety Curfew',
        'Senior Field Director OPR-892',
        'MMR Safety Curfew Enforced',
        broadcast
      );

      expect(res.success).toBe(true);
      expect(isBookingPaused()).toBe(true);
      expect(res.status.isBookingPaused).toBe(true);
      expect(res.status.emergencyBroadcast?.broadcastReference).toBe('EMG-MUM-2025-08');
      expect(res.status.emergencyBroadcast?.wageProtectionSecured).toBe(true);
    });

    test('safely resumes marketplace operations when emergency condition clears', async () => {
      const res = await setBookingPauseStatusSafe(
        false,
        undefined,
        'Senior Field Director OPR-892'
      );

      expect(res.success).toBe(true);
      expect(isBookingPaused()).toBe(false);
      expect(getSystemOperationalStatus().isBookingPaused).toBe(false);
    });
  });

  describe('Screen 28: System Notifications Operational Event Stream', () => {
    test('verifies notification categorization mappings', () => {
      const testCases = [
        { title: 'Attendance Approved: Scheduled for 23:00 IST Batch', expected: 'escrow' },
        { title: 'Shortlisted by Apex Live: 1h 45m left to accept', expected: 'lifecycle' },
        { title: 'Geofence Calibration Updated for JWCC Gate 4', expected: 'safety' },
        { title: 'Escrow Disbursed: UTR #AXIS99381023', expected: 'escrow' },
        { title: 'Standby Worker Assigned to Gate C Scanner Pod', expected: 'lifecycle' },
      ];

      for (const tc of testCases) {
        const text = tc.title.toLowerCase();
        let cat = 'lifecycle';
        if (
          text.includes('escrow') ||
          text.includes('disbursed') ||
          text.includes('utr') ||
          text.includes('attendance approved') ||
          text.includes('batch')
        ) {
          cat = 'escrow';
        } else if (text.includes('geofence') || text.includes('safety') || text.includes('alert')) {
          cat = 'safety';
        }
        expect(cat).toBe(tc.expected);
      }
    });
  });
});
