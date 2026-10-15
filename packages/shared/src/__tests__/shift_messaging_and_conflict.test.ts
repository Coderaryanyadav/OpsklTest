import {
  checkShiftConflicts,
  calculateWorkerTrustScore,
  sendShiftMessage,
  reportWorkerDelaySafe,
} from '../supabase/shift_messaging';
import { Job, Booking, WorkerProfile } from '../types';

describe('Shift Messaging, Scheduling, and Worker Trust System', () => {
  const baseJob: Job = {
    id: 'job-101',
    organizerId: 'org-1',
    title: 'Hospitality Banquet Captain',
    category: 'hospitality',
    description: 'Lead banquet crew for corporate gala in BKC.',
    date: '2026-10-25',
    startTime: '14:00',
    endTime: '22:00',
    durationHours: 8,
    hourlyRate: 350,
    totalPay: 2800,
    slotsTotal: 5,
    slotsFilled: 2,
    venueName: 'Jio World Convention Centre',
    venueAddress: 'G Block BKC, Bandra Kurla Complex',
    zone: 'Bandra / BKC',
    city: 'Mumbai',
    status: 'published',
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-15T00:00:00Z',
  };

  describe('Feature 1: Smart Shift Calendar & Conflict Detection', () => {
    it('detects direct schedule overlap on the same date', () => {
      const overlappingBooking: Booking = {
        id: 'book-1',
        jobId: 'job-other',
        workerId: 'worker-1',
        organizerId: 'org-2',
        status: 'confirmed',
        agreedHourlyRate: 300,
        agreedTotalPay: 1800,
        confirmedAt: '2026-10-15T00:00:00Z',
        job: {
          ...baseJob,
          id: 'job-other',
          title: 'Morning Registration Desk',
          startTime: '10:00',
          endTime: '16:00', // overlaps 14:00 - 16:00 with baseJob
        },
      };

      const result = checkShiftConflicts(baseJob, [overlappingBooking]);
      expect(result.hasConflict).toBe(true);
      expect(result.hasTravelWarning).toBe(false);
      expect(result.message).toContain('Direct Schedule Overlap');
    });

    it('warns about tight commute travel time between different Mumbai zones', () => {
      const morningSouthMumbaiShift: Booking = {
        id: 'book-2',
        jobId: 'job-south-mumbai',
        workerId: 'worker-1',
        organizerId: 'org-3',
        status: 'confirmed',
        agreedHourlyRate: 300,
        agreedTotalPay: 1200,
        confirmedAt: '2026-10-15T00:00:00Z',
        job: {
          ...baseJob,
          id: 'job-south-mumbai',
          title: 'Exhibition Greeter',
          startTime: '09:00',
          endTime: '13:00', // Ends at 13:00, baseJob starts at 14:00 (only 60 mins buffer)
          zone: 'South Mumbai', // Different zone than BKC
        },
      };

      const result = checkShiftConflicts(baseJob, [morningSouthMumbaiShift]);
      expect(result.hasConflict).toBe(false);
      expect(result.hasTravelWarning).toBe(true);
      expect(result.message).toContain('Tight Transit Warning');
      expect(result.recommendedBufferMinutes).toBe(90);
    });

    it('allows shifts on the same date when travel buffer is comfortable (> 90 mins)', () => {
      const earlyShift: Booking = {
        id: 'book-3',
        jobId: 'job-early',
        workerId: 'worker-1',
        organizerId: 'org-4',
        status: 'confirmed',
        agreedHourlyRate: 300,
        agreedTotalPay: 1200,
        confirmedAt: '2026-10-15T00:00:00Z',
        job: {
          ...baseJob,
          id: 'job-early',
          startTime: '06:00',
          endTime: '11:00', // 3 hours buffer before 14:00
          zone: 'Andheri West',
        },
      };

      const result = checkShiftConflicts(baseJob, [earlyShift]);
      expect(result.hasConflict).toBe(false);
      expect(result.hasTravelWarning).toBe(false);
    });

    it('ignores cancelled or no-show bookings during conflict calculation', () => {
      const cancelledBooking: Booking = {
        id: 'book-4',
        jobId: 'job-cancelled',
        workerId: 'worker-1',
        organizerId: 'org-5',
        status: 'cancelled',
        agreedHourlyRate: 300,
        agreedTotalPay: 1800,
        confirmedAt: '2026-10-15T00:00:00Z',
        job: {
          ...baseJob,
          id: 'job-cancelled',
          startTime: '14:00',
          endTime: '22:00',
        },
      };

      const result = checkShiftConflicts(baseJob, [cancelledBooking]);
      expect(result.hasConflict).toBe(false);
      expect(result.hasTravelWarning).toBe(false);
    });
  });

  describe('Feature 2: Worker Trust and Reliability Score', () => {
    it('grants a clean 100 base score and New tier to a new crew member', () => {
      const score = calculateWorkerTrustScore(null);
      expect(score.score).toBe(100);
      expect(score.tier).toBe('New');
      expect(score.attendanceReliabilityPct).toBe(100);
      expect(score.completedShiftsCount).toBe(0);
    });

    it('promotes high-performing verified workers to Elite tier', () => {
      const veteranWorker: WorkerProfile = {
        id: 'w-veteran',
        preferredLocality: 'Bandra',
        serviceAreas: ['Mumbai'],
        skills: ['Hospitality', 'Captain'],
        experienceYears: 3,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
        verificationStatus: 'verified',
        rating: 5.0,
        shiftsCompleted: 12,
      };

      const score = calculateWorkerTrustScore(veteranWorker, 0);
      expect(score.score).toBe(100);
      expect(score.tier).toBe('Elite');
      expect(score.completedShiftsCount).toBe(12);
    });

    it('shields workers from automated penalty during active disputes', () => {
      const activeWorker: WorkerProfile = {
        id: 'w-dispute',
        preferredLocality: 'Dadar',
        serviceAreas: ['Mumbai'],
        skills: ['Barista'],
        experienceYears: 1,
        availabilityStatus: 'available',
        profileCompletionStatus: 'completed',
        verificationStatus: 'verified',
        rating: 4.8,
        shiftsCompleted: 4,
      };

      const score = calculateWorkerTrustScore(activeWorker, 1);
      expect(score.unresolvedDisputesCount).toBe(1);
      const disputeChip = score.breakdown.find((b) => b.label === 'Dispute Shield');
      expect(disputeChip).toBeDefined();
      expect(disputeChip?.value).toContain('Pending Review (Shielded)');
      expect(disputeChip?.positive).toBe(true);
    });
  });

  describe('Feature 4 & 5: In-Shift Messaging and Delay Reporting Guards', () => {
    it('validates empty messages when attempting to send shift message', async () => {
      const res = await sendShiftMessage('job-1', '   ');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Message cannot be empty.');
    });

    it('rejects unauthenticated message senders gracefully', async () => {
      const res = await sendShiftMessage('job-1', 'Reporting to Gate 3 at 13:30');
      // When unauthenticated in unit test environment
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
