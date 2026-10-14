import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Job,
  DiscoveryFeedFilters,
  fetchDiscoveryFeed,
  applyForJobSafe,
  recordSwipePass,
  undoSwipePass,
} from '@opskil/shared';
import { GeoLocation, MUMBAI_ZONES } from '../utils/location';

export interface FailedApplicationState {
  job: Job;
  errorCode?: string;
  errorMessage: string;
}

// Fallback seed jobs for Mumbai market demo when Supabase database has 0 published shifts
const SEED_MUMBAI_JOBS: Job[] = [
  {
    id: 'job-mum-101',
    organizerId: 'org-apex-01',
    title: 'Registration Desk & VIP Usher',
    category: 'conference',
    venueName: 'Jio World Convention Centre, Pavilion 2',
    venueAddress: 'G Block BKC, Bandra Kurla Complex, Bandra East, Mumbai 400098',
    landmark: 'Opposite Bharat Diamond Bourse',
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
    dressCode: 'Formal black shirt, black trousers, black formal shoes.',
    duties: [
      'Scan attendee QR entry passes at turnstiles using provided handheld terminals',
      'Issue delegate badge lanyards and conference kits',
      'Direct delegates toward Keynote Hall A and Executive Boardrooms',
    ],
    perks: ['Catered lunch & refreshments provided', 'Air conditioned hall', 'UPI transfer upon supervisor sign-off'],
    requiredSkills: ['Guest Relations', 'Fluent English', 'Basic Tech Navigation'],
    eligibilityCriteria: 'Minimum 18 years old, punctuality is mandatory.',
    applicationDeadline: '2026-10-13T22:00:00Z',
    breaksMinutes: 45,
    mealProvided: true,
    transportProvided: false,
    overtimePolicy: '₹200/hr after scheduled shift duration.',
    latitude: 19.062,
    longitude: 72.864,
    supervisorName: 'Rohit Verma',
    supervisorPhone: '+91 98201 98201',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: {
      id: 'org-apex-01',
      businessName: '[Sample Host] Apex Event Productions',
      businessType: 'event_agency',
      verificationStatus: 'verified',
      profileCompletionStatus: 'completed',
      businessContactPhone: '+91 98201 98201',
      rating: 4.9,
      totalEventsHosted: 42,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'job-mum-102',
    organizerId: 'org-nesco-02',
    title: 'Exhibition Booth Assistant',
    category: 'exhibition',
    venueName: 'Bombay Exhibition Centre (NESCO), Hall 4',
    venueAddress: 'Western Express Highway, Goregaon East, Mumbai 400063',
    landmark: 'Near Ram Mandir Railway Station',
    city: 'Mumbai',
    zone: 'Goregaon & NESCO',
    date: '2026-10-15',
    startTime: '09:00',
    endTime: '18:00',
    durationHours: 9,
    hourlyRate: 175,
    totalPay: 1575,
    slotsTotal: 8,
    slotsFilled: 3,
    dressCode: 'Smart casuals / company polo provided at registration.',
    duties: [
      'Greet expo visitors and hand out product brochures',
      'Log visitor visitor inquiry cards onto tablet form',
      'Keep booth demo counters organized and restocked',
    ],
    perks: ['Packed lunch & high tea provided', 'Experience certificate', 'UPI transfer upon attendance sign-off'],
    requiredSkills: ['Customer Service', 'Hindi & English Fluency'],
    eligibilityCriteria: 'College students or freshers welcome. Energetic communication skills.',
    applicationDeadline: '2026-10-14T20:00:00Z',
    breaksMinutes: 60,
    mealProvided: true,
    transportProvided: false,
    overtimePolicy: '₹190/hr for additional show hours.',
    latitude: 19.1482,
    longitude: 72.853,
    supervisorName: 'Pooja Mehta',
    supervisorPhone: '+91 98330 45678',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: {
      id: 'org-nesco-02',
      businessName: '[Sample Host] Spectra Trade Shows',
      businessType: 'corporate',
      verificationStatus: 'verified',
      profileCompletionStatus: 'completed',
      businessContactPhone: '+91 98330 45678',
      rating: 4.8,
      totalEventsHosted: 28,
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
  },
  {
    id: 'job-mum-103',
    organizerId: 'org-cidco-03',
    title: 'Crowd & Queue Marshall',
    category: 'activation',
    venueName: 'CIDCO Exhibition & Convention Centre',
    venueAddress: 'Sector 30A, Vashi, Navi Mumbai 400703',
    landmark: 'Opposite Vashi Railway Station',
    city: 'Mumbai',
    zone: 'Navi Mumbai (Vashi / CIDCO)',
    date: '2026-10-16',
    startTime: '10:00',
    endTime: '19:00',
    durationHours: 9,
    hourlyRate: 165,
    totalPay: 1485,
    slotsTotal: 16,
    slotsFilled: 11,
    dressCode: 'Opskl high-visibility vest (provided), dark jeans, running sneakers.',
    duties: [
      'Manage security barricade entry queues',
      'Guide attendees toward designated entrance gates',
      'Assist venue security with crowd flow control',
    ],
    perks: ['Travel allowance (₹150 included)', 'Bottled water & snack pack', 'UPI transfer upon attendance sign-off'],
    requiredSkills: ['Crowd Management', 'Physical Stamina', 'Hindi Speaking'],
    eligibilityCriteria: 'Must be comfortable standing on foot for shift periods.',
    applicationDeadline: '2026-10-15T18:00:00Z',
    breaksMinutes: 45,
    mealProvided: true,
    transportProvided: true,
    overtimePolicy: '₹180/hr after 19:00.',
    latitude: 19.076,
    longitude: 72.998,
    supervisorName: 'Sachin Kulkarni',
    supervisorPhone: '+91 99201 11223',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: {
      id: 'org-cidco-03',
      businessName: '[Sample Host] Vanguard Activation',
      businessType: 'event_agency',
      verificationStatus: 'verified',
      profileCompletionStatus: 'completed',
      businessContactPhone: '+91 99201 11223',
      rating: 4.7,
      totalEventsHosted: 64,
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    },
  },
  {
    id: 'job-mum-104',
    organizerId: 'org-nehru-04',
    title: 'Backstage Runner & Speaker Concierge',
    category: 'corporate',
    venueName: 'Nehru Centre Auditorium',
    venueAddress: 'Dr. Annie Besant Road, Worli, Mumbai 400018',
    landmark: 'Next to Nehru Planetarium',
    city: 'Mumbai',
    zone: 'Worli & South Mumbai',
    date: '2026-10-17',
    startTime: '08:00',
    endTime: '16:00',
    durationHours: 8,
    hourlyRate: 200,
    totalPay: 1600,
    slotsTotal: 6,
    slotsFilled: 4,
    dressCode: 'All-black semi-formal attire with black shoes.',
    duties: [
      'Coordinate speaker green room refreshments and tech check alerts',
      'Deliver stage notes between show producer and stage manager',
      'Ensure microphones and clickers are placed on podium between sessions',
    ],
    perks: ['Full five-star hotel buffet lunch', 'VIP industry access badge', 'UPI transfer upon attendance sign-off'],
    requiredSkills: ['Backstage Etiquette', 'Prompt Communication', 'Discretion'],
    eligibilityCriteria: 'Previous event or theatre backstage experience preferred.',
    applicationDeadline: '2026-10-16T12:00:00Z',
    breaksMinutes: 30,
    mealProvided: true,
    transportProvided: false,
    overtimePolicy: '₹220/hr if session overruns.',
    latitude: 19.0178,
    longitude: 72.818,
    supervisorName: 'Ananya Roy',
    supervisorPhone: '+91 97690 98765',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organizer: {
      id: 'org-nehru-04',
      businessName: '[Sample Host] Elevate Summit Partners',
      businessType: 'corporate',
      verificationStatus: 'verified',
      profileCompletionStatus: 'completed',
      businessContactPhone: '+91 97690 98765',
      rating: 5.0,
      totalEventsHosted: 19,
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    },
  },
];

export function useDiscoveryFeed(workerId: string | null) {
  const [cards, setCards] = useState<Job[]>([]);
  const [passedHistory, setPassedHistory] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<DiscoveryFeedFilters>({
    category: 'all',
    zone: 'All Zones',
  });
  const [workerLocation, setWorkerLocation] = useState<GeoLocation | null>(
    MUMBAI_ZONES[0].coords // Default to BKC center
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Failure recovery state
  const [failedApplication, setFailedApplication] = useState<FailedApplicationState | null>(null);
  const [inFlightApplication, setInFlightApplication] = useState<Job | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadFeed = useCallback(
    async (isPullToRefresh = false) => {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchDiscoveryFeed({
          workerId: workerId ?? undefined,
          filters,
          page: 1,
          pageSize: 30,
        });

        if (!isMounted.current) return;

        // If backend query encountered an error or RLS rejection, surface error state immediately — do NOT mask with demo fixtures
        if (result.error) {
          setError(result.error);
          setCards([]);
          return;
        }

        let activeJobs = result.jobs;
        // Strict integrity: only use seed fixtures if explicitly configured for demo mode
        const allowDemoFixtures = process.env.EXPO_PUBLIC_USE_DEMO_FIXTURES === 'true';
        if (activeJobs.length === 0 && allowDemoFixtures) {
          activeJobs = SEED_MUMBAI_JOBS.map((j) => ({
            ...j,
            isSampleListing: true,
            title: `[SAMPLE PREVIEW] ${j.title}`,
          })).filter((job) => {
            if (filters.category && filters.category !== 'all' && job.category !== filters.category) {
              return false;
            }
            if (filters.zone && filters.zone !== 'All Zones' && !job.zone.includes(filters.zone)) {
              return false;
            }
            if (filters.minWage && job.totalPay < filters.minWage) {
              return false;
            }
            if (appliedJobIds.has(job.id)) {
              return false;
            }
            return true;
          });
        }

        // Filter out any already applied job IDs in session
        activeJobs = activeJobs.filter((j) => !appliedJobIds.has(j.id));

        setCards(activeJobs);
      } catch (err: any) {
        if (!isMounted.current) return;
        setError(err.message || 'Failed to load shifts feed');
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [workerId, filters, appliedJobIds]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  /**
   * Swipe Right / Apply Handler with Optimistic UI & Safety Rollback Guarantee
   */
  const handleApply = useCallback(
    async (job: Job) => {
      if (!job) return;

      // Never substitute a fake 'demo-worker-id' when unauthenticated
      if (!workerId) {
        setFailedApplication({
          job,
          errorCode: 'AUTH_REQUIRED',
          errorMessage: 'Sign-in required: Please sign in with an active worker account before applying for shifts.',
        });
        return;
      }

      // Sample demonstration listings cannot be applied for, booked, or paid against
      if (job.id.startsWith('job-mum-') || (job as any).isSampleListing) {
        setFailedApplication({
          job,
          errorCode: 'SAMPLE_LISTING_UNAVAILABLE',
          errorMessage: 'This is a sample demonstration listing for market preview. Live applications cannot be submitted against sample data.',
        });
        return;
      }

      // 1. Optimistic removal from deck
      setCards((prev) => prev.filter((c) => c.id !== job.id));
      setInFlightApplication(job);

      // 2. Execute safe server-side application
      const result = await applyForJobSafe(job.id, workerId);

      setInFlightApplication(null);

      if (result.success) {
        // Success: mark as applied
        setAppliedJobIds((prev) => new Set(prev).add(job.id));
      } else {
        // "A successful swipe animation must not be mistaken for a successful backend submission.
        // If the request fails, restore the card or let the user retry safely."
        setFailedApplication({
          job,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage || 'Server rejected application',
        });
      }
    },
    [workerId]
  );

  /**
   * Swipe Left / Pass Handler with Undo Tracking
   */
  const handlePass = useCallback(
    async (job: Job) => {
      if (!job) return;

      // 1. Optimistic removal from deck & push to undo stack
      setCards((prev) => prev.filter((c) => c.id !== job.id));
      setPassedHistory((prev) => [job, ...prev]);

      // 2. Record pass event in background if authenticated and not a sample listing
      if (workerId && !job.id.startsWith('job-mum-') && !(job as any).isSampleListing) {
        await recordSwipePass(job.id, workerId);
      }
    },
    [workerId]
  );

  /**
   * Undo Last Passed Shift
   */
  const handleUndoLastPass = useCallback(async () => {
    if (passedHistory.length === 0) return;

    const [lastPassed, ...rest] = passedHistory;
    setPassedHistory(rest);

    // Restore to top of cards deck
    setCards((prev) => [lastPassed, ...prev]);

    // Delete left swipe event in backend
    if (workerId && !lastPassed.id.startsWith('job-mum-') && !(lastPassed as any).isSampleListing) {
      await undoSwipePass(lastPassed.id, workerId);
    }
  }, [passedHistory, workerId]);

  /**
   * Failure Recovery Action: Restore Card to Deck
   */
  const handleRestoreFailedCard = useCallback(() => {
    if (!failedApplication) return;
    const { job } = failedApplication;
    setCards((prev) => [job, ...prev]);
    setFailedApplication(null);
  }, [failedApplication]);

  /**
   * Failure Recovery Action: Retry Backend Application
   */
  const handleRetryFailedApplication = useCallback(async () => {
    if (!failedApplication) return;
    const { job } = failedApplication;
    setFailedApplication(null);
    await handleApply(job);
  }, [failedApplication, handleApply]);

  return {
    cards,
    currentCard: cards[0] || null,
    nextCard: cards[1] || null,
    passedHistory,
    appliedJobIds,
    loading,
    refreshing,
    error,
    filters,
    workerLocation,
    failedApplication,
    inFlightApplication,
    setFilters,
    setWorkerLocation,
    onApply: handleApply,
    onPass: handlePass,
    onUndo: handleUndoLastPass,
    onRestoreFailedCard: handleRestoreFailedCard,
    onRetryFailedApplication: handleRetryFailedApplication,
    onRefresh: () => loadFeed(true),
  };
}
