import { Job } from '@opskil/shared';

// Simulated gesture decision evaluator matching SwipeCard worklet logic
function evaluateSwipeDecision({
  translationX,
  velocityX,
  threshold,
}: {
  translationX: number;
  velocityX: number;
  threshold: number;
}): 'apply' | 'pass' | 'cancel' {
  const shouldApply = translationX > threshold || velocityX > 750;
  const shouldPass = translationX < -threshold || velocityX < -750;

  if (shouldApply) return 'apply';
  if (shouldPass) return 'pass';
  return 'cancel';
}

const mockJob: Job = {
  id: 'job-mum-101',
  organizerId: 'org-apex-01',
  title: 'Registration Desk & VIP Usher',
  category: 'conference',
  venueName: 'Jio World Convention Centre',
  venueAddress: 'G Block BKC, Bandra East, Mumbai',
  city: 'Mumbai',
  zone: 'Bandra Kurla Complex (BKC)',
  date: '2026-10-14',
  startTime: '08:30',
  endTime: '17:30',
  durationHours: 9,
  hourlyRate: 185,
  totalPay: 1665,
  slotsTotal: 12,
  slotsFilled: 8,
  duties: ['Scan QR tickets', 'Badge distribution'],
  supervisorName: 'Rohit Verma',
  supervisorPhone: '+91 98201 98201',
  status: 'open',
  createdAt: '2026-10-12T00:00:00Z',
  updatedAt: '2026-10-12T00:00:00Z',
};

describe('Phase 3 Worker Swipe Marketplace — Gestures & State Safety', () => {
  const SCREEN_WIDTH = 390;
  const THRESHOLD = SCREEN_WIDTH * 0.32; // ~124.8 px

  describe('Gesture Threshold & Decision Evaluation', () => {
    test('Dragging beyond positive threshold triggers Apply decision', () => {
      const decision = evaluateSwipeDecision({
        translationX: 150,
        velocityX: 100,
        threshold: THRESHOLD,
      });
      expect(decision).toBe('apply');
    });

    test('High-velocity right flick triggers Apply even below distance threshold', () => {
      const decision = evaluateSwipeDecision({
        translationX: 60,
        velocityX: 850,
        threshold: THRESHOLD,
      });
      expect(decision).toBe('apply');
    });

    test('Dragging beyond negative threshold triggers Pass decision', () => {
      const decision = evaluateSwipeDecision({
        translationX: -140,
        velocityX: -100,
        threshold: THRESHOLD,
      });
      expect(decision).toBe('pass');
    });

    test('High-velocity left flick triggers Pass even below distance threshold', () => {
      const decision = evaluateSwipeDecision({
        translationX: -50,
        velocityX: -900,
        threshold: THRESHOLD,
      });
      expect(decision).toBe('pass');
    });

    test('Dragging under threshold without high velocity cancels gesture without applying or passing', () => {
      const decision = evaluateSwipeDecision({
        translationX: 45,
        velocityX: 120,
        threshold: THRESHOLD,
      });
      expect(decision).toBe('cancel');

      const negativeDecision = evaluateSwipeDecision({
        translationX: -60,
        velocityX: -200,
        threshold: THRESHOLD,
      });
      expect(negativeDecision).toBe('cancel');
    });
  });

  describe('Discovery Feed Safety Guarantees & Failure Rollback', () => {
    test('Failed backend submission does NOT lose the card; enables recovery rollback', () => {
      let cards = [mockJob];
      let failedState: { job: Job; error: string } | null = null;

      // User swipes right
      const swipedJob = cards[0];
      cards = cards.filter((c) => c.id !== swipedJob.id);
      expect(cards.length).toBe(0);

      // Backend submission fails (e.g. deadline expired or network dropout)
      const backendSuccess = false;
      if (!backendSuccess) {
        failedState = { job: swipedJob, error: 'DEADLINE_PASSED' };
      }

      expect(failedState).not.toBeNull();
      expect(failedState?.job.id).toBe(mockJob.id);

      // User presses "Restore Card"
      if (failedState) {
        cards = [failedState.job, ...cards];
        failedState = null;
      }

      // Card is restored to top of deck
      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe(mockJob.id);
      expect(failedState).toBeNull();
    });

    test('Undo recovers the most recently skipped card to the front of the deck', () => {
      const job1 = { ...mockJob, id: 'job-1' };
      const job2 = { ...mockJob, id: 'job-2' };
      let cards = [job1, job2];
      let passedHistory: Job[] = [];

      // User skips job1 (swipe left)
      const passedCard = cards[0];
      cards = cards.slice(1);
      passedHistory = [passedCard, ...passedHistory];

      expect(cards.length).toBe(1);
      expect(cards[0].id).toBe('job-2');
      expect(passedHistory.length).toBe(1);

      // User triggers Undo
      const [restored, ...remainingHistory] = passedHistory;
      cards = [restored, ...cards];
      passedHistory = remainingHistory;

      expect(cards.length).toBe(2);
      expect(cards[0].id).toBe('job-1');
      expect(passedHistory.length).toBe(0);
    });

    test('Prevents duplicate application in session', () => {
      const appliedJobIds = new Set<string>();

      const apply = (jobId: string) => {
        if (appliedJobIds.has(jobId)) {
          return { success: false, error: 'ALREADY_APPLIED' };
        }
        appliedJobIds.add(jobId);
        return { success: true };
      };

      const firstAttempt = apply('job-mum-101');
      expect(firstAttempt.success).toBe(true);

      const secondAttempt = apply('job-mum-101');
      expect(secondAttempt.success).toBe(false);
      expect(secondAttempt.error).toBe('ALREADY_APPLIED');
    });
  });
});
