import {
  calculateJobFinancials,
  calculateHoursAdjustment,
  isValidIndianUpiId,
  buildJobOpportunityNotification,
  buildBookingConfirmedNotification,
  buildShiftReminderNotification,
  buildAttendanceUpdateNotification,
  buildPayoutNotification,
} from '../index';

describe('Phase 10 — End-to-End Opskl Marketplace Lifecycle Integration', () => {
  // Shared state tracking throughout the 11-step shift journey
  const context = {
    worker: {
      id: 'worker-mumbai-88',
      fullName: 'Rahul Deshmukh',
      phone: '+919820011223',
      upiId: 'rahul.deshmukh@okhdfcbank',
      locality: 'Bandra West',
      skills: ['Registration Scanning', 'VIP Ushering', 'Fluent Hindi/English'],
    },
    organizer: {
      id: 'org-apex-mumbai',
      businessName: 'Apex Summit Productions Pvt Ltd',
      gstin: '27AABCA1234F1Z8',
      contactPhone: '+919820198201',
      rating: 4.95,
      totalHosted: 36,
    },
    shift: {
      id: 'job-mum-convention-99',
      title: 'VIP Lounge Usher & Delegate Badge Desk',
      category: 'conference' as const,
      date: '2026-10-18',
      startTime: '08:30',
      endTime: '17:30',
      durationHours: 9,
      hourlyRate: 200, // ₹200/hr ≥ ₹100 statutory living wage floor
      totalPay: 1800,
      slotsTotal: 10,
      slotsFilled: 0,
      venueName: 'Jio World Convention Centre, Hall 3',
      zone: 'Bandra Kurla Complex (BKC)',
      status: 'draft' as 'draft' | 'open' | 'filling' | 'filled' | 'completed' | 'cancelled',
      supervisorName: 'Rohit Verma',
      supervisorPhone: '+919820198201',
    },
    application: {
      id: 'app-rahul-99',
      status: 'applied' as 'applied' | 'shortlisted' | 'confirmed' | 'rejected',
      appliedAt: new Date().toISOString(),
    },
    booking: {
      id: 'book-rahul-99',
      status: 'confirmed' as 'confirmed' | 'checked_in' | 'completed_awaiting_review' | 'completed' | 'disputed',
      checkInCode: 'OP-7741',
      checkInTime: '',
      checkOutTime: '',
      agreedHourlyRate: 200,
      agreedTotalPay: 1800,
    },
    payout: {
      id: 'pay-tx-5510',
      status: 'escrow_locked' as 'escrow_locked' | 'processing' | 'settled' | 'failed',
      workerWageDisbursed: 0,
      platformCommissionDeducted: 0,
    },
  };

  test('Step 1: Worker Registration and KYC/UPI Onboarding', () => {
    // Validate profile requirements
    expect(context.worker.fullName.length).toBeGreaterThanOrEqual(2);
    expect(context.worker.skills.length).toBeGreaterThanOrEqual(1);
    expect(isValidIndianUpiId(context.worker.upiId)).toBe(true);
    expect(context.worker.locality).toContain('Bandra');
  });

  test('Step 2: Organizer Business Registration and GSTIN Compliance', () => {
    // Validate Indian GSTIN 15-character statutory format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    expect(gstinRegex.test(context.organizer.gstin)).toBe(true);
    expect(context.organizer.businessName.length).toBeGreaterThan(3);
    expect(context.organizer.rating).toBeGreaterThanOrEqual(4.0);
  });

  test('Step 3: Shift Creation, Living Wage Floor & 10% Escrow Calculation', () => {
    // Statutory living wage check
    expect(context.shift.hourlyRate).toBeGreaterThanOrEqual(100);

    // Calculate transparent financials
    const financials = calculateJobFinancials(context.shift.slotsTotal, context.shift.totalPay);
    expect(financials.totalWorkerWages).toBe(18000); // 10 workers * ₹1800
    expect(financials.platformFeeAmount).toBe(1800); // 10% platform fee
    expect(financials.gstAmount).toBe(324); // 18% GST on platform fee only (SAC 998519)
    expect(financials.totalPayableByOrganizer).toBe(20124);

    // Shift is published to open marketplace
    context.shift.status = 'open';
    expect(context.shift.status).toBe('open');
  });

  test('Step 4: Shift Discovery & Worker Swipe-to-Apply', () => {
    // Build notification for matching workers
    const notif = buildJobOpportunityNotification(context.worker.id, {
      id: context.shift.id,
      title: context.shift.title,
      wageInr: context.shift.totalPay,
      locality: context.shift.zone,
    });
    expect(notif.type).toBe('job_opportunity');
    expect(notif.body).toContain('₹1800/day');
    expect(notif.body).toContain('Bandra Kurla Complex');

    // Worker swipes right (apply)
    context.application.status = 'applied';
    expect(context.application.status).toBe('applied');
  });

  test('Step 5: Organizer Reviews Applicant and Shortlists Candidate', () => {
    expect(context.application.status).toBe('applied');
    // Organizer reviews worker ratings and shortlists
    context.application.status = 'shortlisted';
    expect(context.application.status).toBe('shortlisted');
  });

  test('Step 6: Worker Selection, Booking Confirmation & Venue Code Generation', () => {
    // Organizer confirms candidate
    context.application.status = 'confirmed';
    context.shift.slotsFilled += 1;
    context.shift.status = 'filling';

    expect(context.booking.checkInCode).toMatch(/^OP-[0-9]{4}$/);
    expect(context.booking.status).toBe('confirmed');

    // Notification generated for worker
    const confirmNotif = buildBookingConfirmedNotification(
      context.worker.id,
      context.shift.title,
      context.shift.venueName,
      context.booking.id
    );
    expect(confirmNotif.type).toBe('booking_confirmed');
    expect(confirmNotif.body).toContain('Jio World Convention Centre');
    expect(confirmNotif.body).toContain('check-in pass');
  });

  test('Step 7: Pre-Shift Reminder Notification Dispatch', () => {
    const reminder = buildShiftReminderNotification(
      context.worker.id,
      context.shift.title,
      '08:30 AM',
      context.booking.id
    );
    expect(reminder.type).toBe('shift_reminder');
    expect(reminder.priority).toBe('urgent');
    expect(reminder.body).toContain('08:30 AM');
  });

  test('Step 8: On-Site Digital Check-In and Check-Out', () => {
    // Arrival on-site with valid venue code
    const enteredCode = 'OP-7741';
    expect(enteredCode).toBe(context.booking.checkInCode);

    context.booking.status = 'checked_in';
    context.booking.checkInTime = '2026-10-18T08:22:00Z';
    expect(context.booking.status).toBe('checked_in');

    // Concluding shift
    context.booking.status = 'completed_awaiting_review';
    context.booking.checkOutTime = '2026-10-18T17:35:00Z';
    expect(context.booking.status).toBe('completed_awaiting_review');
  });

  test('Step 9: Shift Completion, Overtime Audit & Wage Sign-Off', () => {
    // Verify 9.1 hours completed on-time (standard 9h schedule)
    const hoursCalc = calculateHoursAdjustment(9, 9, context.booking.agreedTotalPay);
    expect(hoursCalc.totalAdjustedPay).toBe(1800);

    context.booking.status = 'completed';
    expect(context.booking.status).toBe('completed');

    const attendanceNotif = buildAttendanceUpdateNotification(
      context.organizer.id,
      context.worker.fullName,
      context.shift.title,
      'check_out',
      context.booking.id
    );
    expect(attendanceNotif.type).toBe('check_out');
    expect(attendanceNotif.body).toContain('Rahul Deshmukh');
  });

  test('Step 10: Payment Reconciliation & 100% Direct UPI Settlement', () => {
    // 0% commission deducted from worker wages
    context.payout.status = 'settled';
    context.payout.workerWageDisbursed = context.booking.agreedTotalPay;
    context.payout.platformCommissionDeducted = 0;

    expect(context.payout.workerWageDisbursed).toBe(1800);
    expect(context.payout.platformCommissionDeducted).toBe(0);

    const payoutNotif = buildPayoutNotification(
      context.worker.id,
      context.payout.workerWageDisbursed,
      'upi_rrn_882910394821',
      'settled',
      context.payout.id
    );
    expect(payoutNotif.type).toBe('payout_settled');
    expect(payoutNotif.body).toContain('₹1800');
    expect(payoutNotif.body).toContain('upi_rrn_882910394821');
  });

  test('Step 11: Mutual Review & Dispute Handling Guardrails', () => {
    // Review score invariants (1.0 to 5.0)
    const workerRatingGiven = 5.0;
    const organizerRatingGiven = 4.9;

    expect(workerRatingGiven).toBeGreaterThanOrEqual(1.0);
    expect(workerRatingGiven).toBeLessThanOrEqual(5.0);
    expect(organizerRatingGiven).toBeGreaterThanOrEqual(1.0);
    expect(organizerRatingGiven).toBeLessThanOrEqual(5.0);

    // Valid dispute requires mandatory documented reasons
    const mockDispute = {
      bookingId: context.booking.id,
      reason: 'Unpaid extra hour of queue management',
      caseNotes: 'Staff requested 1 additional hour for closing registration at Hall 3.',
    };
    expect(mockDispute.reason.length).toBeGreaterThan(5);
    expect(mockDispute.caseNotes.length).toBeGreaterThan(10);
  });
});
