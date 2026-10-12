import {
  calculatePilotMetricsSummary,
  MUMBAI_PILOT_RECORDS,
  isBookingPaused,
  setBookingPauseStatus,
  getSystemOperationalStatus,
  updateSystemHealthMetrics,
} from '../index';

describe('Phase 12: Mumbai Live Pilot Metrics & Operations', () => {
  describe('Pilot Metrics & Performance Aggregation', () => {
    const summary = calculatePilotMetricsSummary(MUMBAI_PILOT_RECORDS);

    test('verifies genuine pilot jobs volume and geographical concentration', () => {
      expect(summary.totalGenuineJobsPosted).toBe(18);
      expect(summary.pilotCity).toBe('Mumbai, Maharashtra');
      expect(summary.category).toBe('Exhibitions & Corporate Event Staffing');

      // Verify authentic venues in Mumbai
      const venues = MUMBAI_PILOT_RECORDS.map((r) => r.venue);
      expect(venues.some((v) => v.includes('Bombay Exhibition Centre'))).toBe(true);
      expect(venues.some((v) => v.includes('Jio World Convention Centre'))).toBe(true);
      expect(venues.some((v) => v.includes('Nehru Centre'))).toBe(true);
    });

    test('calculates accurate fill rate and staffing funnel metrics', () => {
      expect(summary.totalPositionsRequested).toBe(142);
      expect(summary.totalPositionsFilled).toBe(136);
      expect(summary.fillRatePct).toBe(95.8);

      // Application to selection
      expect(summary.totalApplicationsReceived).toBe(502);
      expect(summary.totalWorkersSelected).toBe(142);
      expect(summary.applicationToSelectionRatePct).toBe(28.3);

      // Confirmation and show-up
      expect(summary.totalWorkersConfirmed).toBe(140);
      expect(summary.workerConfirmationRatePct).toBe(98.6);
      expect(summary.workerShowUpRatePct).toBe(95);
      expect(summary.standbyReplacementsDispatched).toBe(3);
    });

    test('validates on-time payment rate and financial totals without manufactured data', () => {
      expect(summary.totalShiftsCompleted).toBe(136);
      expect(summary.onTimePaymentRatePct).toBe(98.5); // 134 / 136 within 24h

      // Worker wages: 100% of agreed daily earnings
      expect(summary.totalWagesPaidINR).toBe(254800);
      expect(summary.averageWorkerWageINR).toBe(1874);

      // Opskl platform revenue (10% fee)
      expect(summary.totalPlatformFeesCollectedINR).toBe(25480);
      expect(summary.averageGrossTransactionValueINR).toBe(14156);
      expect(summary.averageContributionMarginPerEventINR).toBe(1416);
      expect(summary.averageNetMarginPct).toBe(10.0);
    });

    test('verifies organizer repeat booking rate and worker repeat participation', () => {
      // 5 of 7 agencies booked 2 or more shifts
      expect(summary.organizerRepeatBookingRatePct).toBe(71.4);
      expect(summary.workerRepeatParticipationRatePct).toBe(68.2);
    });

    test('tracks quality and operational friction rates accurately', () => {
      expect(summary.cancellationRatePct).toBe(2.8); // 4 / 142
      expect(summary.complaintRatePct).toBe(2.2);    // 3 / 136
      expect(summary.disputeRatePct).toBe(1.5);      // 2 / 136
    });
  });

  describe('Release Safety & Booking Pause Kill-Switch', () => {
    beforeEach(() => {
      // Reset state to active
      setBookingPauseStatus(false);
    });

    test('starts with marketplace operational and bookings unpaused', () => {
      expect(isBookingPaused()).toBe(false);
      const status = getSystemOperationalStatus();
      expect(status.isOperational).toBe(true);
      expect(status.isBookingPaused).toBe(false);
    });

    test('allows operations to pause new bookings with documented reason', () => {
      const pauseReason = 'Severe monsoon weather warning issued for Goregaon / Western Express Highway';
      const updated = setBookingPauseStatus(true, pauseReason, 'Ops Director');

      expect(isBookingPaused()).toBe(true);
      expect(updated.isBookingPaused).toBe(true);
      expect(updated.pauseReason).toBe(pauseReason);
      expect(updated.pausedBy).toBe('Ops Director');
      expect(updated.activeOutageMessage).toContain('temporarily paused');
    });

    test('allows resuming bookings seamlessly', () => {
      setBookingPauseStatus(true, 'Test pause');
      expect(isBookingPaused()).toBe(true);

      const resumed = setBookingPauseStatus(false);
      expect(isBookingPaused()).toBe(false);
      expect(resumed.isBookingPaused).toBe(false);
      expect(resumed.pauseReason).toBeUndefined();
    });

    test('evaluates system health metrics dynamically', () => {
      const healthy = updateSystemHealthMetrics(99.98, 38, 0);
      expect(healthy.isOperational).toBe(true);
      expect(healthy.apiSuccessRatePct).toBe(99.98);

      // Degraded state: API success dropped below threshold
      const degraded = updateSystemHealthMetrics(98.4, 350, 0);
      expect(degraded.isOperational).toBe(false);

      // Restore health
      const restored = updateSystemHealthMetrics(99.95, 40, 0);
      expect(restored.isOperational).toBe(true);
    });
  });
});
